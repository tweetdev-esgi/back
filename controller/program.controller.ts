import mongoose, { Model } from "mongoose"
import { Program, ProgramModel } from "../models"

import * as express from "express"
import { Router, Response, Request } from "express"
import { checkBody, checkUserRole, checkUserToken } from "../middleware"
import { checkQuery } from "../middleware/query.middleware"
import { RolesEnums } from "../enums"

const tar = require('tar-stream');
const path = require('path');
const fs = require('fs')
const Docker = require('dockerode')
const multer = require('multer')


const docker = new Docker();
const upload = multer({ dest: path.join(__dirname, 'uploads') });
interface LanguageConfig {
    extension: string;
    image: string;
    cmd: (filePath: string) => string[];
}

const LANGUAGES: { [key: string]: LanguageConfig } = {
    python: {
        extension: 'py',
        image: 'my-python-image',
        cmd: (filePath: string) => ['python3', filePath]
    },
    javascript: {
        extension: 'js',
        image: 'my-node-image',
        cmd: (filePath: string) => ['node', filePath]
    }
};
const getMimeType = (fileExtension: string | number) => {
    const mimeTypes: { [key: string]: string } = {
        'txt': 'text/plain',
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'py': 'text/x-python',
        'js': 'application/javascript',
        'pdf': 'application/pdf',  // Ajouter des types MIME supplémentaires si nécessaire
        'zip': 'application/zip'
    };
    return mimeTypes[fileExtension] || 'application/octet-stream'; // Retourne 'application/octet-stream' par défaut
};
function writeCodeToFile(code: string, filePath: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        // Ensure the directory exists
        const dir = path.dirname(filePath);
        
        // Create the directory if it does not exist
        fs.mkdir(dir, { recursive: true }, (err: any) => {
            if (err) {
                return reject(err);
            }

            // Write the file
            fs.writeFile(filePath, code, (err: any) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    });
}
function deleteFile(filePath: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        fs.unlink(filePath, (err: any) => {
            if (err) {
                console.error(`Error deleting file ${filePath}:`, err);
                reject(err);
            } else {
                resolve();
            }
        });
    });
}
export class ProgramController {

    readonly path: string
    readonly model: Model<Program>

    constructor(){
        this.path = "/program"
        this.model = ProgramModel
    }

    getAllPrograms = async (req:Request, res:Response): Promise<void> => {
        const programs = await ProgramModel.find()
        res.status(200).json(programs)
        return 
    }
    readonly paramsNewProgram = {
        "name":"string",
        "content" : "string",
        "inputFileType": "string",
        "outputFileType": "string",
        "language": "string"
    }

    newProgram = async (req: Request, res: Response): Promise<void> => {
        const newPost = await ProgramModel.create({
            name: req.body.name,
            content:  req.body.content ,
            like: [],
            comments: [],
            inputFileType:req.body.inputFileType,
            outputFileType:req.body.outputFileType,
            username : req.user?.username,
            creationDate: new Date(),
            language: req.body.language,
        })
        
        res.status(201).json(newPost)
        return 
    }

    readonly paramsUpdateProgram = {
        "name": "string",
        "content": "string",
        "inputFileType": "string",
        "outputFileType": "string",
        "language": "string"
    }

    updateProgram = async (req: Request, res: Response): Promise<void> => {
        const id = req.query.id as string;
        const username = req.user?.username;
    
        if (!username) {
            res.status(401).json({ message: 'You are not logged in' });
            return;
        }
    
        if (!mongoose.Types.ObjectId.isValid(id)) {
            res.status(400).json({ message: 'Invalid program ID format' });
            return;
        }
    
        try {
            const program = await ProgramModel.findById(id);
    
            if (!program) {
                res.status(404).json({ message: 'Program not found' });
                return;
            }
    
            if (program.username !== username) {
                res.status(403).json({ message: 'You do not have permission to update this program' });
                return;
            }
    
            const updateData = {
                name: req.body.name,
                content: req.body.content,
                inputFileType: req.body.inputFileType,
                outputFileType: req.body.outputFileType,
                language: req.body.language,
            };
    
            const updatedProgram = await ProgramModel.findByIdAndUpdate(id, updateData, { new: true });
    
            if (updatedProgram) {
                res.status(200).json(updatedProgram);
            } else {
                res.status(404).json({ message: "Program not found" });
            }
        } catch (error) {
            console.error('Error updating program:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }

    deleteProgram = async (req: Request, res: Response): Promise<void> => {
        const id = req.query.id as string;
        const program = await ProgramModel.findById(id)

        if (program) {
            if (program.username === req.user?.username) {
                await ProgramModel.findByIdAndDelete(id)
                res.status(200).json({ message: "Program deleted successfully" })
            } else {
                res.status(403).json({ message: "You are not authorized to delete this program" })
            }
        } else {
            res.status(404).json({ message: "Program not found" })
        }
    }
    isProgramDeletable = async (req: Request, res: Response): Promise<void> => {
        const id = req.query.id as string;
        const username = req.user?.username;
    
        if (!username) {
            res.status(401).json({ message: 'You are not logged in' });
            return;
        }
    
        if (!mongoose.Types.ObjectId.isValid(id)) {
            res.status(400).json({ message: 'Invalid program ID format' });
            return;
        }
    
        try {
            const program = await ProgramModel.findById(id);
    
            if (!program) {
                res.status(404).json({ message: 'program not found' });
                return;
            }
    
            if (program.username === username) {
                res.status(200).json(true);
                return;
            }
    
            res.status(200).json(false);
        } catch (error) {
            console.error('Error retrieving program:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    };

    getOneProgram = async (req: Request, res: Response): Promise<void> => {
        const id = req.query.id as string;
    
        if (!mongoose.Types.ObjectId.isValid(id)) {
            res.status(400).json({ message: 'Invalid program ID format' })
            return
        }
    
        try {
            const program = await ProgramModel.findById(id)
    
            if (program) {
                res.status(200).json(program)
            } else {
                res.status(404).json({ message: 'Program not found' })
            }
        } catch (error) {
            console.error('Error retrieving program:', error)
            res.status(500).json({ message: 'Internal server error' })
        }
    }

    sanitizeOutput = (output: string): string => {
        // Remove control characters (non-printable characters)
        return output.replace(/[\x00-\x1F\x7F]/g, '').trim();
    };
// Fonction pour nettoyer les fichiers
cleanupFiles = async (hostCodeFilePath: string, hostFilePath?: string): Promise<void> => {
    const cleanupPromises = [deleteFile(hostCodeFilePath)];
    if (hostFilePath) {
        cleanupPromises.push(deleteFile(hostFilePath));
    }
    try {
        await Promise.all(cleanupPromises);
    } catch (cleanupError) {
        console.error('Erreur lors du nettoyage:', cleanupError);
    }
};
executeProgram = async (req: Request, res: Response): Promise<void> => {
    const { language, code, outputFileType } = req.body;
    const file = req.file as Express.Multer.File | undefined;

    // Vérifiez que le langage est pris en charge
    const langConfig = LANGUAGES[language as string];
    if (!langConfig) {
        res.status(400).send('Unsupported language');
        return;
    }

    const containerName = `code-exec-container-${language}`;
    const codeFileName = `script.${langConfig.extension}`;
    const hostCodeFilePath = path.join(__dirname, codeFileName);
    const containerCodeFilePath = `/app/${codeFileName}`;
    const hostFilePath = file ? path.join(__dirname, 'uploads', file.filename) : undefined;
    const containerFilePath = file ? `/app/${file.originalname}` : undefined;

    try {
        // Écrire le code dans un fichier sur l'hôte
        await writeCodeToFile(code as string, hostCodeFilePath);

        // Vérifiez si le conteneur est déjà en cours d'exécution
        let container = docker.getContainer(containerName);
        const containerInfo = await container.inspect().catch(() => null);

        if (containerInfo) {
            // Arrêter et supprimer le conteneur s'il existe
            await container.stop().catch(() => null);
            await container.remove();
        }

        // Créez et démarrez le conteneur avec les fichiers montés
        const binds = [`${hostCodeFilePath}:${containerCodeFilePath}`];
        if (file) {
            binds.push(`${hostFilePath}:${containerFilePath}`);
        }

        container = await docker.createContainer({
            Image: langConfig.image,
            Cmd: langConfig.cmd(containerCodeFilePath),
            name: containerName,
            Tty: true,
            HostConfig: {
                Binds: binds
            },
            AttachStdout: true,
            AttachStderr: true
        });
        await container.start();

        // Obtenez les logs du conteneur
        const logs = await container.logs({
            stdout: true,
            stderr: true,
            follow: true
        });

        // Vérifiez si outputFileType est spécifié
        if (outputFileType !== "void") {
            try {
                // Attendre que le conteneur s'arrête
                await container.wait();
                
                const fileName = "output." + outputFileType;
                const containerPath = `/app/${fileName}`; // Chemin du fichier dans le conteneur

                // Obtenir le fichier depuis le conteneur
                const stream = await container.getArchive({ path: containerPath });
                const extract = tar.extract();

                extract.on('entry', (header: any, stream: { pipe: (arg0: express.Response<any, Record<string, any>>) => void; on: (arg0: string, arg1: any) => void; }, next: any) => {
                    stream.pipe(res);
                    stream.on('end', next);
                });
        
                stream.pipe(extract);

                stream.on('error', async (err: any) => {
                    console.error('Erreur lors de l\'envoi du fichier:', err);
                    res.status(500).send('Erreur lors de l\'envoi du fichier.');
                    // Nettoyage des fichiers en cas d'erreur
                });
            } catch (error) {
                console.error('Erreur lors de la récupération du fichier depuis le conteneur:', error);
                res.status(500).send('Erreur lors de la récupération du fichier.');
                // Nettoyage des fichiers en cas d'erreur
            }
        } else {
            // Si outputFileType n'est pas spécifié, envoyez les logs en réponse
            res.set('Content-Type', 'text/plain');
            logs.on('data', (chunk: Buffer) => {
                res.write(chunk.toString());
            });
            logs.on('end', async () => {
                res.end();
                // Nettoyage des fichiers après l'envoi de la réponse
            });
        }
    } catch (error) {   
        console.error('Erreur:', error);
        res.status(500).send('An error occurred while fetching the logs.');
        // Nettoyage des fichiers en cas d'erreur
        await this.cleanupFiles(hostCodeFilePath, hostFilePath);
    }
};

executePipeline = async (req: Request, res: Response): Promise<void> => {
    const { language, code, outputFileType } = req.body;
    const file = req.file as Express.Multer.File | undefined;

    // Vérifiez que le langage est pris en charge
    const langConfig = LANGUAGES[language as string];
    if (!langConfig) {
        res.status(400).send('Unsupported language');
        return;
    }

    const containerName = `code-exec-container-${language}`;
    const codeFileName = `script.${langConfig.extension}`;
    const volumeName = `code_exec_volume_${language}`;

    try {
        
        // Créez un volume Docker pour le code
        const volume = await docker.createVolume({ Name: volumeName });

        // Chemins pour les fichiers dans le volume
        const containerCodeFilePath = `/app/${codeFileName}`;
        const containerFilePath = file ? `/app/${file.originalname}` : undefined;

        // Créez et démarrez le conteneur avec les volumes montés
        const binds = [`${volumeName}:/app`];
        if (file) {
            const hostFilePath = path.join(__dirname, 'uploads', file.filename);
            await writeCodeToFile(code as string, hostFilePath); // Écrire le fichier d'entrée sur l'hôte pour le monter
            binds.push(`${hostFilePath}:${containerFilePath}`);
        }

        const container = await docker.createContainer({
            Image: langConfig.image,
            Cmd: langConfig.cmd(containerCodeFilePath),
            name: containerName,
            Tty: true,
            HostConfig: {
                Binds: binds
            },
            AttachStdout: true,
            AttachStderr: true
        });
        await container.start();

        // Écrire le code dans le volume
        await writeCodeToFile(code as string, `/var/lib/docker/volumes/${volumeName}/_data/${codeFileName}`);

        // Obtenez les logs du conteneur
        const logs = await container.logs({
            stdout: true,
            stderr: true,
            follow: true
        });

        // Vérifiez si outputFileType est spécifié
        if (outputFileType !== "void") {
            try {
                // Attendre que le conteneur s'arrête
                await container.wait();
                
                const fileName = "output." + outputFileType;
                const containerPath = `/app/${fileName}`; // Chemin du fichier dans le conteneur

                // Obtenir le fichier depuis le conteneur
                const stream = await container.getArchive({ path: containerPath });
                const extract = tar.extract();

                extract.on('entry', (header: any, stream: { pipe: (arg0: express.Response<any, Record<string, any>>) => void; on: (arg0: string, arg1: any) => void; }, next: any) => {
                    stream.pipe(res);
                    stream.on('end', next);
                });
        
                stream.pipe(extract);

                stream.on('error', async (err: any) => {
                    console.error('Erreur lors de l\'envoi du fichier:', err);
                    res.status(500).send('Erreur lors de l\'envoi du fichier.');
                    // Nettoyage des fichiers en cas d'erreur
                });
            } catch (error) {
                console.error('Erreur lors de la récupération du fichier depuis le conteneur:', error);
                res.status(500).send('Erreur lors de la récupération du fichier.');
                // Nettoyage des fichiers en cas d'erreur
            }
        } else {
            // Si outputFileType n'est pas spécifié, envoyez les logs en réponse
            res.set('Content-Type', 'text/plain');
            logs.on('data', (chunk: Buffer) => {
                res.write(chunk.toString());
            });
            logs.on('end', async () => {
                res.end();
                // Nettoyage des fichiers après l'envoi de la réponse
            });
        }
    } catch (error) {   
        console.error('Erreur:', error);
        res.status(500).send('An error occurred while fetching the logs.');
        // Nettoyage des fichiers en cas d'erreur
    }
};

testExecutePipeline = async (req: Request, res: Response): Promise<void> => {
    const { language, code, outputFileType } = req.body;
    const file = req.file as Express.Multer.File | undefined;

    // Vérifiez que le langage est pris en charge
    const langConfig = LANGUAGES[language as string];
    if (!langConfig) {
        res.status(400).send('Unsupported language');
        return;
    }

    const containerName = `code-exec-container-${language}-${Date.now()}`;
    const codeFileName = `script.${langConfig.extension}`;
    const hostCodeFilePath = path.join(__dirname, codeFileName); // Local file path
    const containerCodeFilePath = `/app/${codeFileName}`; // Temp path for the code file in container
    const volumeMountPath = `/data/${codeFileName}`; // Final path in the Docker volume

    try {
        
        // Écrire le code dans un fichier local
        await writeCodeToFile(code as string, hostCodeFilePath);

        // Vérifiez si le conteneur est déjà en cours d'exécution
        let container = docker.getContainer(containerName);
        const containerInfo = await container.inspect().catch(() => null);

        // Étape 2: Créer un volume Docker
        const volume = await docker.createVolume({
            Name: 'my_volume',
        });
        console.log(`Volume créé : ${volume.name}`);

        if (containerInfo) {
            try {
                await container.stop(); // Stop the container
                await container.remove(); // Remove the container
            } catch (error) {
                console.error(`Error stopping/removing container: ${error.message}`);
            }
        }
        // Étape 3: Créer et démarrer un conteneur pour copier le fichier dans le volume
        container = await docker.createContainer({
            Image: langConfig.image,
            name: containerName,
            Tty: true,
            HostConfig: {
                Binds: [`${hostCodeFilePath}:${containerCodeFilePath}`, `my_volume:/data`], // Monte le fichier et le volume
            },
        });

        console.log('Conteneur créé avec succès');

        // Étape 4: Démarrer le conteneur
        await container.start();
        console.log('Conteneur démarré');
        // Étape 6: Exécuter le script dans le volume
        const execRun = await container.exec({
            Cmd: langConfig.cmd(containerCodeFilePath), // Exécuter le script depuis le volume
            AttachStdout: true,
            AttachStderr: true,
        });
  

        const streamRun = await execRun.start();
        let logs = '';

        streamRun.on('data', (data) => {
            logs += data.toString(); // Accumule les logs
        });

     

        // Vérifier si un fichier de sortie est spécifié
        if (outputFileType && outputFileType !== 'void') {
            try {
                const fileName = `output.${outputFileType}`;
                const containerPath = `/data/${fileName}`;
                
                await new Promise(resolve => setTimeout(resolve, 1000)); // Ajuster le timing si nécessaire
            
                // Obtenir le fichier depuis le conteneur
                const stream = await container.getArchive({ path: containerPath });
            
                // Extraire le fichier .tar et envoyer son contenu comme réponse
                const extract = tar.extract();
            
                // Gérer les événements d'extraction
                extract.on('entry', (header, streamEntry, next) => {
                    streamEntry.pipe(res); // Envoie le contenu du fichier dans la réponse
                    streamEntry.on('end', next);
                });
            
                extract.on('finish', () => {
                    console.log('Extraction terminée avec succès.');
                    res.end(); // Terminer la réponse après l'extraction
                });
            
                stream.pipe(extract);
            
                // Gérer les erreurs
                stream.on('error', (err) => {
                    console.error('Erreur lors de l\'extraction du fichier:', err);
                    res.status(500).send('Erreur lors de l\'extraction du fichier.');
                });
            
                extract.on('error', (err) => {
                    console.error('Erreur lors de l\'extraction du fichier:', err);
                    res.status(500).send('Erreur lors de l\'extraction du fichier.');
                });
            
            } catch (error) {
                console.error('Erreur lors de la récupération du fichier depuis le conteneur:', error);
                res.status(500).send('Erreur lors de la récupération du fichier.');
            }
            
        } else {
            // Si aucun fichier de sortie n'est spécifié, envoyer les logs en réponse
            res.set('Content-Type', 'text/plain');
            res.write(logs); // Envoyer les logs accumulés
            res.end();
        }

        // Nettoyage : arrêter et supprimer le conteneur
        await container.stop();
        await container.remove();
        console.log('Conteneur arrêté et supprimé');

    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).send('An error occurred while fetching the logs.');
    }
};


executePipelineTest = async (req: Request, res: Response): Promise<void> => {
    const { language, code, outputFileType } = req.body;
    const file = req.file as Express.Multer.File | undefined;

    // Check if the language is supported
    const langConfig = LANGUAGES[language as string];
    if (!langConfig) {
        res.status(400).send('Unsupported language');
        return;
    }

    const containerName = `code-exec-container-${language}`;
    const codeFileName = `script.${langConfig.extension}`;
    const volumeName = `code_exec_volume_${language}`;

    try {
              // Vérifiez si le conteneur est déjà en cours d'exécution
              let container = docker.getContainer(containerName);
              const containerInfo = await container.inspect().catch(() => null);
      
              if (containerInfo) {
                  // Arrêter et supprimer le conteneur s'il existe
                  await container.stop().catch(() => null);
                  await container.remove();
              }
        // Step 1: Create a Docker volume for the code
        const volume = await docker.createVolume({ Name: volumeName });

        // Paths for files in the container
        const containerCodeFilePath = `/app/${codeFileName}`;
        const containerFilePath = file ? `/app/${file.originalname}` : undefined;

        // Write code to the volume
        const hostCodeFilePath = path.join('/tmp', codeFileName);  // Use /tmp or another accessible directory
        await writeCodeToFile(code as string, hostCodeFilePath);

        const binds = [`code_exec_volume:/app`];
        if (file) {
            const hostFilePath = path.join(__dirname, 'uploads', file.filename);
            binds.push(`${hostFilePath}:${containerFilePath}`);
        }
        
         container = await docker.createContainer({
            Image: langConfig.image,
            Cmd: langConfig.cmd(containerCodeFilePath),
            name: containerName,
            Tty: true,
            HostConfig: { 
                Binds: binds // Use binds array here
            },
            AttachStdout: true,
            AttachStderr: true
        });
        
        await container.start();
// const containerExec = await container.exec({
//     Cmd: ['ls', '/app/'],
//     AttachStdout: true,
//     AttachStderr: true
// });

// const output = await containerExec.start({ Detach: false });
// console.log(output); // Logs the contents of /app/ to check if the file exists

        // Get logs from the container
        const logs = await container.logs({ stdout: true, stderr: true, follow: true });

        // Check if outputFileType is specified
        if (outputFileType !== "void") {
            try {
                await container.wait(); // Wait for container to finish
                const fileName = `output.${outputFileType}`;
                const containerPath = `/app/${fileName}`; // Path to output file in the container

                // Get the output file from the container
                const stream = await container.getArchive({ path: containerPath });
                const extract = tar.extract();

                extract.on('entry', (header: any, stream: any, next: any) => {
                    stream.pipe(res); // Send the file to the client
                    stream.on('end', next);
                });

                stream.pipe(extract);
                stream.on('error', (err: any) => {
                    console.error('Error sending file:', err);
                    res.status(500).send('Error sending file.');
                });
            } catch (error) {
                console.error('Error retrieving file:', error);
                res.status(500).send('Error retrieving file.');
            }
        } else {
            // If no output file type, send the logs
            res.set('Content-Type', 'text/plain');
            logs.on('data', (chunk: Buffer) => {
                res.write(chunk.toString());
            });
            logs.on('end', async () => {
                res.end();
            });
        }

        // Clean up files after execution
        await container.remove();
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('An error occurred during execution.');
    }
};


    download = async (req: Request, res: Response): Promise<void> => {
        const filePath = path.join(__dirname, 'file.txt'); // chemin vers votre fichier
        res.download(filePath);
    }

 getProgramsByUsernameOrSelf = async (req: Request, res: Response): Promise<void> => {
        const queryUsername = req.query.username as string;
        const selfUsername = req.user?.username;
    
        // Vérifiez si un username a été fourni ou utilisez le username de l'utilisateur connecté
        const usernameToSearch = queryUsername || selfUsername;
    
        if (!usernameToSearch) {
            res.status(400).json({ message: 'No username provided and user is not logged in' });
            return;
        }
    
        try {
            const programs = await ProgramModel.find({ username: usernameToSearch });
    
            if (programs.length > 0) {
                res.status(200).json(programs);
            } else {
                res.status(404).json({ message: 'No programs found for the user' });
            }
        } catch (error) {
            console.error('Error retrieving programs:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    };
    
    buildRouter = (): Router => {
        const router = express.Router()
        router.get('/', checkUserToken(), this.getAllPrograms.bind(this))
        router.get('/one', checkUserToken(), this.getOneProgram.bind(this))
        router.get('/user', checkUserToken(), this.getProgramsByUsernameOrSelf.bind(this))

        router.get('/download',  this.download.bind(this))
        router.get('/is-deletable', checkUserToken(), this.isProgramDeletable.bind(this))
        router.post('/', express.json(), checkUserToken(), checkUserRole(RolesEnums.guest), checkBody(this.paramsNewProgram), this.newProgram.bind(this))
        router.put('/', express.json(), checkUserToken(), checkUserRole(RolesEnums.guest), checkBody(this.paramsUpdateProgram), this.updateProgram.bind(this))
        router.delete('/', checkUserToken(), checkUserRole(RolesEnums.guest), this.deleteProgram.bind(this))
        router.post('/execute', express.json(), checkUserToken(),  upload.single('file'), this.testExecutePipeline.bind(this))
        router.post('/pipeline/execute', express.json(), checkUserToken(), upload.single('file'), this.executePipeline.bind(this))
        router.post('/test/pipeline/execute', express.json(), checkUserToken(), upload.single('file'), this.testExecutePipeline.bind(this))

        return router
    }
}
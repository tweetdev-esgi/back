# Étape 1 : Construction
FROM node:16 AS build

# Définir le répertoire de travail
WORKDIR /app

# Copier les fichiers package.json et package-lock.json
COPY package*.json ./

# Installer les dépendances
RUN npm install

# Copier tout le code source
COPY . .

# Compiler TypeScript en JavaScript
RUN npm run build

# Étape 2 : Développement avec Nodemon
FROM node:16

# Définir le répertoire de travail
WORKDIR /app

# Installer nodemon globalement
RUN npm install -g nodemon

# Copier les fichiers compilés depuis l'étape précédente
COPY --from=build /app/dist /app/dist

# Copier les fichiers package.json et package-lock.json
COPY package*.json ./

# Installer les dépendances de production et de développement
RUN npm install

# Copier tout le code source (pour permettre à Nodemon de surveiller les modifications)
COPY . .

# Exposer le port utilisé par l'API
EXPOSE 3000

# Commande pour démarrer l'application avec Nodemon via npm
CMD ["npm", "run", "nodemon"]

# Koristi Node.js osnovnu sliku
FROM node:16

# Instaliraj LibreOffice za konverziju
RUN apt-get update && apt-get install -y libreoffice

# Postavi radni direktorijum
WORKDIR /app

# Kopiraj package.json i package-lock.json
COPY package*.json ./

# Instaliraj zavisnosti
RUN npm install

# Kopiraj aplikacione fajlove
COPY . .

# Ekspoziraj port
EXPOSE 8080

# Pokreni aplikaciju
CMD ["npm", "start"]


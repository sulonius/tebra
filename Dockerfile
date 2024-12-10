# Koristi Node.js sliku
FROM node:18

# Instaliraj LibreOffice
RUN apt-get update && apt-get install -y libreoffice && apt-get clean

# Kreiraj radni direktorijum
WORKDIR /app

# Kopiraj package.json i instaliraj zavisnosti
COPY package.json ./
RUN npm install

# Kopiraj ostatak aplikacije
COPY . .

# Expose porta za aplikaciju
EXPOSE 3000

# Pokreni aplikaciju
CMD ["node", "server.js"]


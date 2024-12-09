FROM node:16

# Instalirajte LibreOffice
RUN apt-get update && apt-get install -y libreoffice

# Postavite radni direktorijum
WORKDIR /app

# Kopirajte package.json i instalirajte zavisnosti
COPY package.json package-lock.json ./
RUN npm install

# Kopirajte ostatak vaših fajlova
COPY . .

# Izložite port na kojem će Render povezati vašu aplikaciju
EXPOSE 3000

# Pokrenite aplikaciju
CMD ["npm", "start"]


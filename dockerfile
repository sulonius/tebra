FROM node:16

# Install LibreOffice
RUN apt-get update && apt-get install -y libreoffice

# Install dependencies
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .

# Expose port
EXPOSE 3000

CMD ["npm", "start"]


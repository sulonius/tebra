# Base image
FROM node:16

# Install LibreOffice
RUN apt-get update && apt-get install -y libreoffice

# Set working directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "index.js"]


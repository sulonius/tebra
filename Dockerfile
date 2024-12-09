# Koristi zvanični Ubuntu kao osnovnu sliku
FROM ubuntu:20.04

# Postavljanje ne-interaktivnog moda za apt-get (da bi instalacija prošla bez interakcije)
ENV DEBIAN_FRONTEND=noninteractive

# Instalacija LibreOffice i drugih zavisnosti
RUN apt-get update && apt-get install -y \
    libreoffice \
    curl \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Postavljanje radnog direktorijuma
WORKDIR /app

# Kopiraj lokalne fajlove u kontejner
COPY . .

# Postavljanje komande za pokretanje aplikacije
CMD ["node", "app.js"]


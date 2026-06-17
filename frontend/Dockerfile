FROM node:22-alpine

WORKDIR /app

# Install dependencies (fresh install, ignore any lock file issues)
COPY package.json ./
RUN npm install

# Copy application
COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# Use an official Node.js 14 image as a base
FROM node:20

# Set the working directory to /app
WORKDIR /app

# Copy the package*.json files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the application code
COPY . .

# Expose the port the app will use
EXPOSE 8080

# Expose the logs directories
VOLUME [ "/app/serverlogs" ]

# Run the command to start the app
CMD ["npm", "start"]
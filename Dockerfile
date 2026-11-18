FROM node:22-alpine
WORKDIR /app
COPY package.json README.md LICENSE ./
COPY bin/ ./bin/
COPY src/ ./src/
CMD ["node", "bin/mcp.js"]

FROM node:22.22.0-bookworm-slim

WORKDIR /workspace

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0"]

### Build stage
FROM node:22-alpine AS builder
WORKDIR /app

# Copy package files first for cached install
COPY package.json package-lock.json* ./
COPY tsconfig.json ./
COPY . .

RUN npm ci --legacy-peer-deps || npm install --legacy-peer-deps

# Valores de compilación. Pásalos desde CI/CD o un archivo de entorno local;
# no se versionan credenciales ni URLs de despliegue en este repositorio.
ARG VITE_BACKEND_URL
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID
ARG VITE_GOOGLE_PLACES_API_KEY
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL \
    VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY \
    VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID \
    VITE_GOOGLE_PLACES_API_KEY=$VITE_GOOGLE_PLACES_API_KEY

RUN npm run build

### Production stage - serve with nginx
FROM nginx:stable-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

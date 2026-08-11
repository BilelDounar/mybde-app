# syntax=docker/dockerfile:1
# ============================================================
# Version web de MyBDE (Expo Router -> export statique + nginx)
# Les builds iOS/Android passent par EAS, pas par ce Dockerfile.
# ============================================================

# --- Étape 1 : export web ---
FROM node:20-alpine AS build
WORKDIR /app

# URL de l'API : injectée au build (EXPO_PUBLIC_* est figé dans le bundle).
ARG EXPO_PUBLIC_API_URL=https://apimybde.kleoz.fr
ENV EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL

COPY package*.json ./
RUN npm ci

COPY . .
# Génère le site statique dans ./dist
RUN npx expo export --platform web

# --- Étape 2 : service des fichiers ---
FROM nginx:1.27-alpine AS production
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

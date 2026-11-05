# SmartPantry & Planner

SPA en React + Vite con Firebase (Anonymous Auth + Cloud Firestore), desplegada en Vercel.
Permite cargar los ingredientes de la heladera, buscar recetas (TheMealDB) y planificar la semana.

## Datos en Firestore
- `users/{uid}/ingredients/{id}`: `name`, `quantity`, `category`, `expiresAt` (texto `YYYY-MM-DD` o `null`), `createdAt`
- `users/{uid}/plan/{dia}_{turno}`: `title`, `thumb`, `recipeId`, `day`, `shift`, `done`, `createdAt`
- `users/{uid}/shopping/{id}`: `name`, `done`, `source` (`manual` | `receta` | `semana`), `createdAt`

> Si actualizás el proyecto, volvé a publicar `firestore.rules` en Firebase: la lista de compras necesita la regla nueva.

## Ejecutar en local
1. `npm install`
2. Copiá `.env.example` a `.env` y completá los 4 valores de `firebaseConfig`.
3. `npm run dev` (reiniciá el servidor si cambiás `.env`).

## Configurar Firebase
1. Firebase Console → crear proyecto (sin Analytics ni Hosting).
2. Agregar app web (`</>`) y copiar `apiKey`, `authDomain`, `projectId`, `appId` al `.env`.
3. Authentication → Sign-in method → habilitar **Anónimo**.
4. Firestore Database → crear base **Standard**, id `(default)`, región `southamerica-east1`, **modo producción**.
5. Pestaña **Reglas** → pegar el contenido de `firestore.rules` → **Publicar**.
   (Vercel NO actualiza las reglas: se publican siempre desde Firebase.)

## Desplegar en Vercel
1. Subir el repo a GitHub (verificá con `git status` que `.env` no esté incluido).
2. Vercel → Add New Project → importar el repo. Framework: **Vite**, build `npm run build`, output `dist`.
3. Settings → Environment Variables → cargar las 4 variables `VITE_FIREBASE_*` en Production.
4. Deploy. Si cambiás variables después, hacé **Redeploy**.
5. Firebase → Authentication → Settings → **Authorized domains** → agregar `tu-proyecto.vercel.app`.
   Sin esto el login anónimo falla en producción.

## Problemas frecuentes
| Síntoma | Causa probable |
|---|---|
| `auth/configuration-not-found` / `auth/operation-not-allowed` | Falta habilitar Anónimo |
| `auth/unauthorized-domain` | Falta agregar el dominio de Vercel |
| `Missing or insufficient permissions` | Reglas sin publicar o uid distinto |
| Pantalla en blanco en Vercel | Variables de entorno sin cargar o sin Redeploy |
| Cambiaste `.env` y nada pasa | Reiniciar `npm run dev` |

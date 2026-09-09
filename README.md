# Amplify Storage Browser React+Vite Starter Template

This repository provides a starter template for creating applications with Storage Browser for S3 using React+Vite and AWS Amplify, emphasizing easy setup for authentication and S3 capabilities.

## Overview

This template equips you with a foundational React application integrated with AWS Amplify Auth and Storage Browser, streamlined for scalability and performance. It is ideal for developers looking to jumpstart their Storage Browser project with pre-configured AWS services like Cognito and S3.

## Features

- **Authentication**: Setup with Amazon Cognito for secure user authentication with email login.
  - More info on how to setup and configuration option: https://docs.amplify.aws/react/build-a-backend/auth/set-up-auth/
- **Storage**: Configured with multiple S3 buckets and granular access controls. The sample is configured with
  - Default `frauden-bucket` storage bucket with `doctrina`, `medios`, `jurisprudencia`, and `legislacion` access paths for authenticated readers and admin read/write/delete access.
  - Secondary `frauden-expedientes` storage bucket with owner-scoped `privado/{entity_id}` access paths. Read/write access is limited to users in the `gexpedientes` group for their own identity folder, with delete permissions for the `eliminadores` group.
  - More info on how to setup : https://docs.amplify.aws/react/build-a-backend/storage/set-up-storage/#building-your-storage-backend
- **UI Components**: Pre-integrated Amplify UI React components including:
  - Authenticator for sign-in/sign-up flows
    - More info : https://ui.docs.amplify.aws/react/connected-components/authenticator
  - Storage Browser for S3 file management.
    - More info : https://ui.docs.amplify.aws/react/connected-components/storage/storage-browser

## Project Structure

```
├── amplify/                  # Amplify Gen 2 backend configuration
│   ├── auth/                 # Authentication configuration
│   ├── storage/              # S3 storage configuration
│   └── backend.ts            # Main backend definition
├── src/
│   ├── App.tsx               # Main application component
│   └── main.tsx              # Application entry point
└── package.json              # Project dependencies
```

## Permisos de almacenamiento

Las precedencias de los grupos de Cognito son únicas y se evalúan en este orden:
`uploaders` (0), `admin` (1), `eliminadores` (2) y `gexpedientes` (3). Por ello,
un usuario que pertenezca a `uploaders` y a cualquier otro de esos grupos conserva
el perfil restrictivo de `uploaders`.

| Perfil efectivo             | Almacenamiento principal (`doctrina/`, `medios/`, `jurisprudencia/`, `legislacion/`)                                                   | `frauden-expedientes`                                   | Acciones visibles                                                                          |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `uploaders`                 | Listar y subir/reemplazar (`ListBucket`, `PutObject`). Denegación explícita de obtener versiones/objetos y eliminar versiones/objetos. | Sin acceso                                              | Solo `Subir`; sin selección, descarga, copia, eliminación ni creación dedicada de carpetas |
| `admin`                     | Lectura y escritura según las reglas de Amplify existentes                                                                             | Sin cambios                                             | Sin cambios                                                                                |
| `eliminadores`              | Eliminación según las reglas de Amplify existentes                                                                                     | Eliminación según las reglas de Amplify existentes      | Sin cambios                                                                                |
| `gexpedientes`              | Sin cambios                                                                                                                            | Lectura/escritura de la carpeta privada de su identidad | Sin cambios                                                                                |
| Autenticado sin esos grupos | Lectura según las reglas de Amplify existentes                                                                                         | Sin acceso por la denegación del rol autenticado        | Sin cambios                                                                                |

`Sincronizar conocimiento` permanece disponible para `uploaders`; su endpoint,
token y payload no cambian. El grupo `uploaders` debe existir previamente en el
User Pool. Amplify genera su rol y salidas de cliente, omite únicamente la creación
del grupo y usa `UpdateGroup` para asociar el grupo existente con el rol generado.

## Vencimiento por inactividad

Toda sesión de esta aplicación web vence tras 60 minutos efectivos sin actividad.
Se consideran actividad el teclado, puntero, toque y desplazamiento, además de las
listas/búsquedas, cargas, copias, eliminaciones, creación de carpetas, preparación
de descargas y solicitudes de sincronización. La renovación automática de tokens
no cuenta como actividad.

Mientras exista una operación activa el cierre se aplaza. Al finalizar la última
operación comienza un nuevo período completo de 60 minutos. La última actividad y
los marcadores de operación se comparten entre pestañas mediante `localStorage` y
`BroadcastChannel`; los marcadores tienen una concesión renovable y caducan si una
pestaña desaparece abruptamente. Al volver a una pestaña se comprueba el vencimiento
antes de aceptar nueva actividad.

El vencimiento ejecuta un cierre local de Cognito una sola vez por pestaña, vuelve
al Authenticator y muestra el motivo. No hay aviso previo ni cierre global de otros
dispositivos. Esta es una garantía de la aplicación web, no un control centralizado
sobre tokens utilizados fuera de ella.

## Getting Started

### Installation

1. Clone this repository

   ```bash
   git clone <repository-url>
   cd sample-amplify-storage-browser
   ```

2. Install dependencies

   ```bash
   npm install
   ```

3. Initialize and deploy the Amplify backend

   ```bash
   npx ampx sandbox
   ```

4. Start the development server
   ```bash
   npm run dev
   ```

## Deploying to AWS

For detailed instructions on deploying your application, refer to the [deployment section](https://docs.amplify.aws/react/start/quickstart/#deploy-a-fullstack-app-to-aws) of our documentation.

## Contributing

See [CONTRIBUTING](CONTRIBUTING.md) for more information.

## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the LICENSE file.

_These sample applications are provided as a reference to help get started easily and are not supported by AWS Support._

# Cardex para Android

Este proyecto está preparado para empaquetarse con Capacitor.

## Requisitos

- Node.js 20+ recomendado.
- Android Studio + Android SDK.
- Java/JDK compatible con la versión de Android Gradle Plugin que instale Capacitor.

## Primera configuración

```bash
npm install
npx cap add android
npm run build
npx cap sync android
npx cap open android
```

`npx cap add android` crea la carpeta `android/`. No se incluye una carpeta Android generada en este ZIP porque debe generarse con la versión instalada de Capacitor/Android SDK del equipo que vaya a compilarla.

## APK de prueba

```bash
npm run android:build
```

La APK de debug quedará en:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## APK/Bundle de publicación

Para generar un Android App Bundle:

```bash
npm run android:release
```

Antes de publicar en Google Play hay que configurar la firma de la aplicación en Android Studio y usar una clave de firma propia.

## Importante: reconocimiento de coches

La aplicación utiliza una función de servidor para el reconocimiento mediante IA (`src/lib/identify.functions.ts`). Una APK que ejecuta los archivos web localmente no puede ejecutar directamente las funciones de servidor de TanStack Start.

Por eso, antes de considerar la APK como versión final, el backend de reconocimiento debe seguir desplegado en un servidor accesible desde Internet y la función cliente debe apuntar a ese backend. **No se debe poner una clave privada de IA dentro de la APK.**

Supabase sí puede seguir utilizándose directamente desde la aplicación con la clave pública (`VITE_SUPABASE_*`), aplicando las políticas RLS del proyecto.

## Identificador de la aplicación

- App ID: `com.cardex.app`
- Nombre: `Cardex`

# Cardex - AAB desde el móvil

1. Crea un repositorio privado en GitHub.
2. Sube TODO el contenido de esta carpeta manteniendo las carpetas `.github` y `src`.
3. Ve a **Actions** y ejecuta **Build Cardex Android AAB** con **Run workflow**.
4. Cuando termine, abre la ejecución y descarga `cardex-release-aab` en **Artifacts**.

## Firma para Google Play

Para publicar en Google Play necesitas un AAB firmado. El workflow acepta estos cuatro GitHub Secrets:

- `KEYSTORE_BASE64`
- `KEYSTORE_PASSWORD`
- `KEY_ALIAS`
- `KEY_PASSWORD`

No subas la keystore al repositorio ni la compartas en el chat.

Si todavía no tienes una keystore, puedes crearla desde un ordenador o desde Android con una terminal que tenga Java/keytool, y después convertirla a Base64 para guardarla como `KEYSTORE_BASE64`.

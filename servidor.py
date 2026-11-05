"""Vista previa local de Huellitas. Ejecutar con: python servidor.py.

Python sirve los archivos al navegador; las funciones de la página siguen
en app.js. Este archivo es opcional y no se ejecuta en GitHub Pages.
Solo utiliza la biblioteca estándar de Python 3.
"""

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


def main():
    # Usar la carpeta del archivo, aunque se ejecute desde otra ubicación.
    carpeta = Path(__file__).resolve().parent
    manejador = partial(SimpleHTTPRequestHandler, directory=str(carpeta))

    try:
        # Escuchar solo en esta computadora.
        servidor = ThreadingHTTPServer(("127.0.0.1", 8000), manejador)
    except OSError as error:
        print(f"No se pudo iniciar la vista previa: {error}")
        print("Comprueba que no tengas otro servidor usando el puerto 8000.")
        return 1

    with servidor:
        print("Huellitas está disponible en http://127.0.0.1:8000", flush=True)
        print("Abre esa dirección en tu navegador. Para detener: Ctrl+C.", flush=True)
        try:
            servidor.serve_forever()
        except KeyboardInterrupt:
            print("\nVista previa detenida.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

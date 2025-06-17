import { useEffect, useRef, useState } from "react";
import type { ActionData } from "~/routes/productos.nuevo";
import type { FetcherWithComponents } from "@remix-run/react";

interface ProductFormProps {
  onClose: () => void;
  defaultValues?: {
    id?: string;
    name: string;
    description?: string;
    price: number;
    images?: Array<{
      id: string;
      url: string;
      uuid: string;
    }> | null;
  };
  fetcher: FetcherWithComponents<ActionData>;
}

export default function ProductForm({ onClose, defaultValues, fetcher }: ProductFormProps) {
  const isSubmitting = fetcher.state === "submitting";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [existingImages, setExistingImages] = useState<Array<{ id: string; url: string; uuid: string }>>(
    defaultValues?.images || []
  );
  const [currentImages, setCurrentImages] = useState<Array<{ id: string; url: string; uuid: string }>>(defaultValues?.images || []);

  // Efecto para actualizar las imágenes existentes cuando cambian los defaultValues
  useEffect(() => {
    setExistingImages(defaultValues?.images || []);
  }, [defaultValues?.images]);

  // UseEffect para actualizar currentImages cuando defaultValues cambian (ej. al abrir el drawer para un nuevo producto)
  // o al seleccionar un producto diferente en edición.
  // La `key` en el ProductForm padre es el principal mecanismo de reinicio, pero esto asegura la sincronización.
  useEffect(() => {
    console.log("ProductForm: defaultValues changed. Re-initializing internal state.");
    setCurrentImages(defaultValues?.images || []); // Reinicializa las imágenes mostradas
    // También resetear el input de archivo para que no guarde el archivo del intento anterior
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [defaultValues]); // Dependencia: defaultValues (observa cambios en todo el objeto defaultValues)

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.success) {
      // Resetear el formulario
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      onClose();
      console.log("Producto guardado exitosamente:", fetcher.data);
    } else if (fetcher.state === "idle" && fetcher.data?.errors) {
      console.log("Errores en el formulario:", fetcher.data.errors);
    }
  }, [fetcher.data, fetcher.state, onClose]);

  return (
    <fetcher.Form
      method="post"
      action="/productos/nuevo"
      encType="multipart/form-data"
      className="space-y-6"
    >
      {defaultValues?.id && (
        <input type="hidden" name="productId" value={defaultValues.id} />
      )}

      {fetcher.data?.errors?.form && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/50 dark:text-red-200">
          {fetcher.data.errors.form}
        </div>
      )}

      <div>
        <label
          htmlFor="name"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Nombre del Producto
        </label>
        <input
          type="text"
          id="name"
          name="name"
          required
          defaultValue={defaultValues?.name || ""}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        />
        {fetcher.data?.errors?.name && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
            {fetcher.data.errors.name}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="description"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Descripción
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={defaultValues?.description || ""}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        />
        {fetcher.data?.errors?.description && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
            {fetcher.data.errors.description}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="price"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Precio
        </label>
        <div className="relative mt-1 rounded-md shadow-sm">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <span className="text-gray-500 dark:text-gray-400">$</span>
          </div>
          <input
            type="number"
            id="price"
            name="price"
            step="0.01"
            min="0"
            required
            defaultValue={defaultValues?.price || ""}
            className="block w-full rounded-md border border-gray-300 pl-7 pr-12 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </div>
        {fetcher.data?.errors?.price && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
            {fetcher.data.errors.price}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="images"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Imágenes del Producto
        </label>
        <input
          ref={fileInputRef}
          type="file"
          id="images"
          name="images"
          multiple
          accept="image/*"
          className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100 dark:text-gray-400 dark:file:bg-blue-900/50 dark:file:text-blue-300 dark:hover:file:bg-blue-900"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Formatos permitidos: JPG, PNG, GIF. Tamaño máximo: 20MB por imagen.
        </p>
        {fetcher.data?.errors?.images && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
            {fetcher.data.errors.images}
          </p>
        )}

        {/* Mostrar imágenes existentes */}
        {existingImages.length > 0 && (
          <div className="mt-4">
            <h4 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              Imágenes Actuales
            </h4>
            <div className="grid grid-cols-4 gap-4">
              {existingImages.map((image) => (
                <div
                  key={image.id}
                  className="relative aspect-square overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700"
                >
                  <img
                    src={image.url}
                    alt="Imagen del producto"
                    className="h-full w-full object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed dark:focus:ring-offset-gray-900"
        >
          {isSubmitting
            ? "Guardando..."
            : defaultValues?.id
            ? "Actualizar Producto"
            : "Guardar Producto"}
        </button>
      </div>
    </fetcher.Form>
  );
}

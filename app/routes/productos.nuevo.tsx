import { json, type ActionFunctionArgs, unstable_parseMultipartFormData, unstable_createMemoryUploadHandler } from "@remix-run/node";
import { supabase } from "~/utils/supabase.server";
import { randomUUID } from "crypto";
import { redirect } from "@remix-run/node";

export type ActionData = {
  success?: string;
  errors?: {
    name?: string;
    description?: string;
    price?: string;
    images?: string;
    form?: string;
  };
  productId?: string;
};

// Constantes para límites de tamaño
const MAX_FILE_SIZE = 20_000_000; // 20MB
const MAX_TOTAL_SIZE = 50_000_000; // 50MB para múltiples archivos

export const action = async ({ request }: ActionFunctionArgs) => {
  // Configurar el uploadHandler para archivos
  const uploadHandler = unstable_createMemoryUploadHandler({
    maxPartSize: MAX_FILE_SIZE,
  });

  try {
    let formData;
    try {
      // Parsear el formData con soporte para archivos
      formData = await unstable_parseMultipartFormData(request, uploadHandler);
    } catch (error) {
      console.error("Error al procesar el formulario:", error);
      
      // Manejar específicamente el error de tamaño excedido
      if (error instanceof Error && error.message.includes("exceeded upload size")) {
        return json<ActionData>(
          {
            errors: {
              images: `Una o más imágenes superan el límite de ${MAX_FILE_SIZE / 1_000_000}MB por archivo.`,
            },
          },
          { status: 413 }
        );
      }
      
      // Para otros errores de procesamiento del formulario
      return json<ActionData>(
        {
          errors: {
            form: "Error al procesar el formulario. Por favor, intenta de nuevo.",
          },
        },
        { status: 400 }
      );
    }
    
    // Debug: Ver todos los campos recibidos
    console.log('FormData received:', [...formData.entries()].map(([key, value]) => {
      if (value instanceof File) {
        return [key, { name: value.name, type: value.type, size: value.size }];
      }
      return [key, value];
    }));
    
    // Extraer campos del formulario
    const productId = formData.get("productId")?.toString();
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const price = formData.get("price") as string;
    const imageFiles = formData.getAll("images") as File[];

    // Debug: Verificar archivos de imagen
    console.log('Image Files detected:', imageFiles.length, imageFiles.map(file => ({
      name: file.name,
      type: file.type,
      size: file.size
    })));

    // Validación de campos
    const errors: ActionData["errors"] = {};
    if (!name?.trim()) {
      errors.name = "El nombre es requerido";
    }
    if (!price || isNaN(Number(price)) || Number(price) <= 0) {
      errors.price = "El precio debe ser un número positivo";
    }

    // Validar tamaño total de las imágenes
    const totalSize = imageFiles.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > MAX_TOTAL_SIZE) {
      errors.images = `El tamaño total de las imágenes (${(totalSize / 1_000_000).toFixed(1)}MB) excede el límite de ${MAX_TOTAL_SIZE / 1_000_000}MB.`;
    }

    if (Object.keys(errors).length > 0) {
      return json<ActionData>({ errors }, { status: 400 });
    }

    let productResult;

    if (!productId) {
      // INSERT: Crear nuevo producto
      const { data: newProduct, error: productError } = await supabase
        .from("products")
        .insert([
          {
            name: name.trim(),
            description: description?.trim() || null,
            price: Number(price),
          },
        ])
        .select("id")
        .single();

      if (productError) {
        console.error("Error al crear el producto:", productError);
        throw new Error("Error al crear el producto en la base de datos");
      }

      console.log('Producto creado exitosamente:', newProduct);
      productResult = newProduct;
    } else {
      // UPDATE: Actualizar producto existente
      const { data: updatedProduct, error: updateError } = await supabase
        .from("products")
        .update({
          name: name.trim(),
          description: description?.trim() || null,
          price: Number(price),
        })
        .eq("id", productId)
        .select("id")
        .single();

      if (updateError) {
        console.error("Error al actualizar el producto:", updateError);
        throw new Error("Error al actualizar el producto en la base de datos");
      }

      console.log('Producto actualizado exitosamente:', updatedProduct);
      productResult = updatedProduct;
    }

    // Procesar imágenes si existen
    if (imageFiles.length > 0) {
      const imagePromises = imageFiles.map(async (file) => {
        try {
          // Validar tipo y tamaño de archivo
          if (!file.type.startsWith("image/")) {
            console.warn(`Archivo ignorado: ${file.name} - No es una imagen válida`);
            return null;
          }

          if (file.size > MAX_FILE_SIZE) {
            console.warn(`Archivo ignorado: ${file.name} - Excede el tamaño máximo de ${MAX_FILE_SIZE / 1_000_000}MB`);
            return null;
          }

          // Generar UUID único para la imagen
          const imageUuid = randomUUID();
          const fileExtension = file.name.split(".").pop();
          const storagePath = `products/${productResult.id}/${imageUuid}.${fileExtension}`;

          console.log('Intentando subir imagen:', {
            path: storagePath,
            size: file.size,
            type: file.type
          });

          // Subir imagen a Supabase Storage
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from("product-images")
            .upload(storagePath, file, {
              upsert: true,
              contentType: file.type,
            });

          if (uploadError) {
            console.error("Error al subir imagen:", uploadError);
            return null;
          }

          console.log('Imagen subida exitosamente:', uploadData);

          // Obtener URL pública
          const { data: { publicUrl } } = supabase.storage
            .from("product-images")
            .getPublicUrl(storagePath);

          console.log('URL pública generada:', publicUrl);

          if (!publicUrl) {
            console.error("No se pudo obtener la URL pública para:", storagePath);
            return null;
          }

          // Registrar imagen en la tabla images
          const { error: imageError } = await supabase.from("images").insert([
            {
              uuid: imageUuid,
              url: publicUrl,
              product_id: productResult.id,
            },
          ]);

          if (imageError) {
            console.error("Error al registrar imagen en la base de datos:", imageError);
            return null;
          }

          console.log('Imagen registrada exitosamente en la base de datos');
          return publicUrl;
        } catch (error) {
          console.error("Error procesando imagen:", error);
          return null;
        }
      });

      // Esperar a que todas las imágenes se procesen
      const results = await Promise.all(imagePromises);
      const successfulUploads = results.filter(url => url !== null);
      
      console.log('Resumen de subida de imágenes:', {
        total: imageFiles.length,
        exitosas: successfulUploads.length,
        fallidas: imageFiles.length - successfulUploads.length
      });

      if (successfulUploads.length === 0 && imageFiles.length > 0) {
        errors.images = "No se pudo subir ninguna imagen";
      }
    }

    return json<ActionData>({
      success: productId
        ? "Producto actualizado exitosamente"
        : "Producto y sus imágenes guardados exitosamente",
      productId: productResult.id,
    });
  } catch (error) {
    console.error("Error en la acción:", error);
    return json<ActionData>(
      {
        errors: {
          form: error instanceof Error ? error.message : "Error desconocido al procesar la solicitud",
        },
      },
      { status: 500 }
    );
  }
};

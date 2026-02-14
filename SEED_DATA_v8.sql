-- SEED DATA v8.0
-- Execute this AFTER running the schema setup

-- 1. Insert Sample Leads
INSERT INTO public.leads (id, kommo_id, nombre, telefono, email, ciudad, estado_emocional_actual, confidence_score, funnel_stage, dias_en_funnel) VALUES
('e0e2a890-1c4b-4a5e-9e7f-b8c9d0e1f2a3', '12345678', 'Carlos Ruiz', '+5215512345678', 'carlos.ruiz@gmail.com', 'CDMX', 'PRAGMÁTICO', 85, 'NEGOCIACION', 5),
('f1f3b901-2d5c-5b6f-0f8a-c9d0e1f2a3b4', '87654321', 'Ana López', '+5213387654321', 'ana.lopez@outlook.com', 'Guadalajara', 'CURIOSO', 60, 'DESCUBRIMIENTO', 2),
('a2a4c012-3e6d-6c7a-1a9b-d0e1f2a3b4c5', '55667788', 'Roberto Gómez', '+5218155667788', 'robert.g@yahoo.com', 'Monterrey', 'FRUSTRADO', 30, 'OBJECIONES', 12);

-- 2. Insert Sample Conversations for Lead 1 (Carlos - Pragmático)
INSERT INTO public.conversaciones (lead_id, mensaje, emisor, platform, created_at) VALUES
('e0e2a890-1c4b-4a5e-9e7f-b8c9d0e1f2a3', 'Hola, vi el anuncio del curso Samurai. ¿Precio?', 'CLIENTE', 'WHATSAPP', NOW() - INTERVAL '2 hours'),
('e0e2a890-1c4b-4a5e-9e7f-b8c9d0e1f2a3', 'Saludos, Carlos. El programa Samurai de Ventas tiene una inversión de $4,997 MXN. ¿Buscas mejorar tus cierres o tu prospección?', 'SAMURAI', 'WHATSAPP', NOW() - INTERVAL '1 hour 59 minutes'),
('e0e2a890-1c4b-4a5e-9e7f-b8c9d0e1f2a3', 'Cierres. Pero se me hace caro.', 'CLIENTE', 'WHATSAPP', NOW() - INTERVAL '1 hour 50 minutes'),
('e0e2a890-1c4b-4a5e-9e7f-b8c9d0e1f2a3', 'Comprendo que el precio es un factor. Sin embargo, un solo cierre adicional al mes pagaría el curso. ¿Te gustaría ver el temario de Cierres Maestros?', 'SAMURAI', 'WHATSAPP', NOW() - INTERVAL '1 hour 48 minutes');

-- 3. Insert Sample Conversations for Lead 3 (Roberto - Frustrado)
INSERT INTO public.conversaciones (lead_id, mensaje, emisor, platform, created_at) VALUES
('a2a4c012-3e6d-6c7a-1a9b-d0e1f2a3b4c5', 'Llevo 3 días esperando mi acceso y nada.', 'CLIENTE', 'WHATSAPP', NOW() - INTERVAL '5 hours'),
('a2a4c012-3e6d-6c7a-1a9b-d0e1f2a3b4c5', 'Mis disculpas por la demora, Roberto. Permíteme verificar con soporte técnico inmediatamente.', 'SAMURAI', 'WHATSAPP', NOW() - INTERVAL '4 hours 59 minutes');

-- 4. Insert Sample Activity Logs
INSERT INTO public.activity_logs (username, action, resource, description, status, created_at) VALUES
('Samurai AI', 'CREATE', 'LEAD', 'Nuevo lead capturado: Carlos Ruiz', 'OK', NOW() - INTERVAL '2 hours'),
('Samurai AI', 'UPDATE', 'LEAD', 'Carlos Ruiz etiquetado como [PRAGMATICO]', 'OK', NOW() - INTERVAL '1 hour 50 minutes'),
('Gamey', 'LOGIN', 'AUTH', 'Inicio de sesión exitoso', 'OK', NOW() - INTERVAL '30 minutes'),
('Gamey', 'UPDATE', 'BRAIN', 'Actualización de Prompt Core v2.1', 'OK', NOW() - INTERVAL '15 minutes'),
('System', 'ERROR', 'SYSTEM', 'Fallo conexión webhook Make (Retry 1/3)', 'ERROR', NOW() - INTERVAL '5 minutes');

-- 5. Insert Sample Knowledge Docs
INSERT INTO public.knowledge_documents (title, type, category, size, description) VALUES
('Manual de Objeciones 2026', 'PDF', 'Ventas', '2.4 MB', 'Guía maestra para rebatir precio y competencia.'),
('Catálogo de Precios Q1', 'SHEET', 'Productos', 'Link', 'Lista de precios actualizada enero 2026.'),
('Script de Bienvenida', 'TXT', 'Soporte', '12 KB', 'Plantillas de saludo inicial.');

-- 6. Insert Media Assets
INSERT INTO public.media_assets (title, url, type, tags) VALUES
('Video Promo Samurai', 'https://example.com/video.mp4', 'VIDEO', '{promo,intro}'),
('Flyer Descuento', 'https://example.com/flyer.jpg', 'IMAGE', '{oferta,visual}');
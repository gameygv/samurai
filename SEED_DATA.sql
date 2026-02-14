-- Insertar documentos de ejemplo en la Base de Conocimientos
INSERT INTO public.knowledge_documents (title, type, category, size, description, created_at)
VALUES 
('Manual de Ventas 2024', 'PDF', 'Ventas', '2.4 MB', 'Guía completa de cierre de ventas y manejo de objeciones para el equipo comercial.', NOW() - INTERVAL '1 day'),
('Lista de Precios Oficial', 'SHEET', 'Productos', 'Link', 'Spreadsheet con precios actualizados al día de hoy. Incluye descuentos por volumen.', NOW() - INTERVAL '2 days'),
('Términos y Condiciones', 'DOC', 'Legal', '850 KB', 'Documento legal para adjuntar en propuestas comerciales grandes.', NOW() - INTERVAL '5 days'),
('Scripts de Saludo', 'TXT', 'Soporte', '12 KB', 'Plantillas de texto para iniciar conversaciones en WhatsApp y Chatbot.', NOW() - INTERVAL '1 week'),
('Catálogo de Cuencos Tibetanos', 'PDF', 'Productos', '15 MB', 'Catálogo visual con fotos de alta resolución de la nueva colección.', NOW() - INTERVAL '2 weeks'),
('Política de Envíos', 'NOTION', 'Logística', 'Link', 'Página de Notion con los tiempos de entrega por zona y paquetería.', NOW() - INTERVAL '3 weeks');

-- Insertar logs de actividad de ejemplo para que el Dashboard no se vea vacío
INSERT INTO public.activity_logs (action, resource, description, status, username, created_at)
VALUES
('LOGIN', 'AUTH', 'Inicio de sesión exitoso', 'OK', 'demo_user', NOW() - INTERVAL '5 minutes'),
('CREATE', 'BRAIN', 'Documento "Manual de Ventas" indexado', 'OK', 'system', NOW() - INTERVAL '1 hour'),
('UPDATE', 'SYSTEM', 'Actualización de Webhook de Make', 'OK', 'admin', NOW() - INTERVAL '3 hours'),
('ERROR', 'IA', 'Fallo al conectar con API de Visión', 'ERROR', 'system', NOW() - INTERVAL '1 day');

-- Insertar configuración inicial (Prompts) si no existen
INSERT INTO public.app_config (key, value, category, description)
VALUES 
('prompt_core', 'Eres un asistente experto en ventas...', 'PROMPT', 'Prompt principal del sistema')
ON CONFLICT (key) DO NOTHING;
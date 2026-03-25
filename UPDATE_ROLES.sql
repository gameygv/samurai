-- Este script unifica los roles antiguos de ventas en un solo rol estándar 'sales_agent'
-- Asegurando consistencia en toda la base de datos.

UPDATE profiles 
SET role = 'sales_agent' 
WHERE role IN ('agent', 'sales');
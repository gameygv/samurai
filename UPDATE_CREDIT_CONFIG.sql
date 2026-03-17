ALTER TABLE public.credit_sales 
ADD COLUMN reminder_days_before INTEGER[] DEFAULT ARRAY[1],
ADD COLUMN overdue_reminder_interval INTEGER DEFAULT 3,
ADD COLUMN msg_template_client TEXT DEFAULT '👋 Hola {nombre}, te recordamos amablemente que tu próximo pago por *${monto}* vence el *{fecha}*. Cualquier duda, estamos a tu disposición.',
ADD COLUMN msg_template_agent TEXT DEFAULT '⚠️ RECORDATORIO COBRANZA: El pago de *${monto}* del cliente *{nombre}* vence el *{fecha}*. Por favor, da seguimiento.';
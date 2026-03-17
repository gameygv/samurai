ALTER TABLE public.credit_sales
ADD COLUMN down_payment NUMERIC DEFAULT 0,
ADD COLUMN seq_pre_days INTEGER DEFAULT 1,
ADD COLUMN seq_post1_days INTEGER DEFAULT 1,
ADD COLUMN seq_post2_days INTEGER DEFAULT 8,
ADD COLUMN seq_abandon_days INTEGER DEFAULT 15,
ADD COLUMN msg_pre TEXT DEFAULT '👋 Hola {nombre}, te recordamos que mañana vence tu pago de *${monto}*.',
ADD COLUMN msg_post1 TEXT DEFAULT '⚠️ Hola {nombre}, notamos que tu pago de *${monto}* venció ayer. ¿Tuviste algún contratiempo?',
ADD COLUMN msg_post2 TEXT DEFAULT '🚨 Hola {nombre}, tu pago de *${monto}* tiene una semana de atraso. Por favor contáctanos urgente para evitar penalizaciones.',
ADD COLUMN msg_abandon_agent TEXT DEFAULT '🚨 ALERTA CRÍTICA: El cliente *{nombre}* ha superado el límite de impago y fue marcado como ABANDONADO.';
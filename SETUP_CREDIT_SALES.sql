-- Crear tabla de Ventas a Crédito
CREATE TABLE public.credit_sales (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
    responsible_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    concept TEXT NOT NULL,
    total_amount NUMERIC NOT NULL,
    currency TEXT DEFAULT 'MXN',
    status TEXT DEFAULT 'ACTIVE', -- ACTIVE, COMPLETED, CANCELLED
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.credit_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "credit_sales_all_access" ON public.credit_sales
FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'dev', 'gerente'))
);

-- Crear tabla de Parcialidades (Pagos programados)
CREATE TABLE public.credit_installments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sale_id UUID REFERENCES public.credit_sales(id) ON DELETE CASCADE,
    installment_number INTEGER NOT NULL,
    amount NUMERIC NOT NULL,
    due_date DATE NOT NULL,
    status TEXT DEFAULT 'PENDING', -- PENDING, PAID, LATE
    reminder_sent_at TIMESTAMP WITH TIME ZONE,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.credit_installments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "credit_installments_all_access" ON public.credit_installments
FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'dev', 'gerente'))
);
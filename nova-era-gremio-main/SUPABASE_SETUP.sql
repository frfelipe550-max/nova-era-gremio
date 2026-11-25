-- Execute no SQL Editor do Supabase.
-- A tabela já foi criada na etapa anterior; este arquivo complementa as permissões.

-- Permite leitura e envio público (as políticas de SELECT e INSERT já criadas continuam válidas).
GRANT SELECT, INSERT ON public.comentarios TO anon, authenticated;
GRANT UPDATE, DELETE ON public.comentarios TO authenticated;

-- Somente usuários autenticados podem responder, editar ou excluir.
DROP POLICY IF EXISTS "Admins podem atualizar comentarios" ON public.comentarios;
CREATE POLICY "Admins podem atualizar comentarios"
ON public.comentarios FOR UPDATE TO authenticated
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins podem excluir comentarios" ON public.comentarios;
CREATE POLICY "Admins podem excluir comentarios"
ON public.comentarios FOR DELETE TO authenticated
USING (auth.role() = 'authenticated');

-- IMPORTANTE:
-- No Dashboard, desative novos cadastros públicos em Authentication > Settings > Signups.
-- Crie manualmente apenas a conta da equipe em Authentication > Users > Add user.
-- Assim, somente a conta criada pela equipe poderá autenticar e usar as políticas acima.

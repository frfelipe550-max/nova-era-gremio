-- Opcional: importa os dois comentários de exemplo que estavam em data/comentarios.json.
-- Execute apenas se quiser manter esses exemplos no banco. ON CONFLICT evita duplicar IDs.
INSERT INTO public.comentarios (id, nome, turma, mensagem, data, resposta)
VALUES
(
  'comentario-001',
  'Estudante Exemplo',
  '2º A',
  'Gostaria de sugerir uma melhoria para nossa escola: ampliar o tempo de empréstimo de jogos na biblioteca durante o intervalo.',
  '2026-11-17',
  '{"texto":"Obrigado pela sugestão! Vamos discutir essa possibilidade com a coordenação da biblioteca na próxima reunião.","data":"2026-11-18"}'::jsonb
),
(
  'comentario-002',
  'Estudante Exemplo 2',
  '1º B',
  'Parabéns pela transparência do novo site! Seria muito legal ter também torneio de xadrez no interclasses.',
  '2026-11-18',
  NULL
)
ON CONFLICT (id) DO NOTHING;

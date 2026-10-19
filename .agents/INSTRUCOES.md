# Instruções de Operação (Modus Operandi)

Sempre que receber uma tarefa, este é o loop de trabalho obrigatório:

1. **ENTENDER (Contexto)**:
   - Leia `.agent/PLANO.md` para entender onde estamos no projeto.
   - Use `grep` ou `xd://lsp` para identificar arquivos e componentes impactados antes de qualquer edição.

2. **PLANEJAR (Update)**:
   - Se a tarefa for complexa, quebre-a em subtarefas no `.agent/PLANO.md`.
   - Se a tarefa já estiver no plano, verifique se não há dependências pendentes.

3. **EXECUTAR (Ação)**:
   - Aplique as mudanças mantendo a consistência do estilo do projeto (React/Tailwind/TypeScript).

4. **VALIDAR (Prova)**:
   - Sempre rode os testes (`npm test`) antes de marcar como pronto.
   - Verifique visualmente os componentes alterados (se aplicável).

5. **REPORTAR (Estado)**:
   - Atualize o `.agent/PLANO.md`, marcando os itens concluídos.

### Regras de Ouro:
- Nunca assuma; sempre verifique a tipagem (`src/types/`).
- Em caso de dúvida sobre integrações Supabase, consulte `src/integrations/supabase/client.ts`.
- Se algo quebrar, PARE e reporte imediatamente.
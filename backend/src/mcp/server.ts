import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { mcpTools, McpContext } from './tools';

export function createMcpServer(context: McpContext) {
  const server = new McpServer({
    name: 'zapo-manager-server',
    version: process.env.APP_VERSION || '1.6.24',
  });

  for (const tool of mcpTools) {
    server.tool(
      tool.name,
      tool.description,
      tool.paramsSchema.shape as any,
      async (args: any) => {
        try {
          const result = await tool.execute(args, context);
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (err: any) {
          return {
            isError: true,
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify({ error: err.message || 'Internal MCP tool execution error' }),
              },
            ],
          };
        }
      }
    );
  }

  return server;
}

/**
 * API Documentation Generator
 * 
 * Generates OpenAPI/Swagger documentation for API endpoints.
 * Provides a centralized registry of all API endpoints with their schemas.
 * 
 * @example
 * const docs = new ApiDocumentation();
 * docs.addEndpoint({
 *   path: '/api/servers',
 *   method: 'GET',
 *   description: 'Get all servers',
 *   responses: { 200: { description: 'List of servers' } }
 * });
 */

export interface ApiParameter {
  name: string;
  in: 'query' | 'path' | 'header';
  description: string;
  required?: boolean;
  schema?: {
    type: string;
    format?: string;
  };
}

export interface ApiResponse {
  description: string;
  schema?: {
    type: string;
    properties?: Record<string, any>;
  };
}

export interface ApiEndpoint {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  description: string;
  tags?: string[];
  parameters?: ApiParameter[];
  requestBody?: {
    description?: string;
    required?: boolean;
    content: {
      'application/json': {
        schema: Record<string, any>;
      };
    };
  };
  responses: Record<number, ApiResponse>;
  security?: Array<Record<string, string[]>>;
}

export interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  servers: Array<{
    url: string;
    description: string;
  }>;
  paths: Record<string, Record<string, any>>;
  components?: {
    schemas?: Record<string, any>;
    securitySchemes?: Record<string, any>;
  };
}

/**
 * API Documentation registry and generator
 */
export class ApiDocumentation {
  private endpoints: Map<string, ApiEndpoint> = new Map();
  private title: string;
  private version: string;
  private description: string;

  constructor(
    title: string = 'GTARP Player Count Tracker API',
    version: string = '1.0.0',
    description: string = 'API documentation for GTARP Player Count Tracker'
  ) {
    this.title = title;
    this.version = version;
    this.description = description;
  }

  /**
   * Add an endpoint to the documentation
   */
  addEndpoint(endpoint: ApiEndpoint): void {
    const key = `${endpoint.method} ${endpoint.path}`;
    this.endpoints.set(key, endpoint);
  }

  /**
   * Add multiple endpoints
   */
  addEndpoints(endpoints: ApiEndpoint[]): void {
    endpoints.forEach((endpoint) => this.addEndpoint(endpoint));
  }

  /**
   * Get all registered endpoints
   */
  getEndpoints(): ApiEndpoint[] {
    return Array.from(this.endpoints.values());
  }

  /**
   * Generate OpenAPI specification
   */
  generateOpenAPISpec(): OpenAPISpec {
    const paths: Record<string, Record<string, any>> = {};

    this.endpoints.forEach((endpoint) => {
      if (!paths[endpoint.path]) {
        paths[endpoint.path] = {};
      }

      const method = endpoint.method.toLowerCase();
      paths[endpoint.path][method] = {
        summary: endpoint.description,
        tags: endpoint.tags || ['default'],
        parameters: endpoint.parameters || [],
        requestBody: endpoint.requestBody,
        responses: this.formatResponses(endpoint.responses),
        security: endpoint.security,
      };
    });

    return {
      openapi: '3.0.0',
      info: {
        title: this.title,
        version: this.version,
        description: this.description,
      },
      servers: [
        {
          url: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
          description: 'API Server',
        },
      ],
      paths,
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    };
  }

  /**
   * Format responses for OpenAPI spec
   */
  private formatResponses(
    responses: Record<number, ApiResponse>
  ): Record<string, any> {
    const formatted: Record<string, any> = {};

    Object.entries(responses).forEach(([status, response]) => {
      formatted[status] = {
        description: response.description,
        content: response.schema
          ? {
              'application/json': {
                schema: response.schema,
              },
            }
          : undefined,
      };
    });

    return formatted;
  }

  /**
   * Generate HTML documentation page
   */
  generateHtmlDocs(): string {
    const spec = this.generateOpenAPISpec();
    const specJson = JSON.stringify(spec, null, 2);

    return `
<!DOCTYPE html>
<html>
  <head>
    <title>${this.title}</title>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">
    <style>
      body {
        margin: 0;
        padding: 0;
        font-family: 'Roboto', sans-serif;
        background: #f5f5f5;
      }
      .swagger-ui {
        max-width: 1460px;
        margin: 0 auto;
      }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@3/swagger-ui.js"></script>
    <script>
      const spec = ${specJson};
      SwaggerUIBundle({
        spec: spec,
        dom_id: '#swagger-ui',
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout"
      });
    </script>
  </body>
</html>
    `;
  }
}

/**
 * Global API documentation instance
 */
export const apiDocs = new ApiDocumentation();

/**
 * Register all API endpoints
 */
export function registerApiEndpoints(): void {
  apiDocs.addEndpoints([
    {
      path: '/api/status/refresh',
      method: 'GET',
      description: 'Get server refresh status',
      tags: ['Status'],
      responses: {
        200: {
          description: 'Server refresh status',
          schema: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              generatedAt: { type: 'string', format: 'date-time' },
              thresholdMinutes: { type: 'number' },
              staleCount: { type: 'number' },
              servers: { type: 'array' },
            },
          },
        },
        500: {
          description: 'Internal server error',
        },
      },
    },
    {
      path: '/api/feedback',
      method: 'POST',
      description: 'Submit user feedback',
      tags: ['Feedback'],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['title', 'description', 'type'],
              properties: {
                title: { type: 'string' },
                description: { type: 'string' },
                type: { type: 'string', enum: ['bug', 'feature', 'feedback'] },
                email: { type: 'string', format: 'email' },
                serverName: { type: 'string' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Feedback submitted successfully',
        },
        400: {
          description: 'Invalid request',
        },
        500: {
          description: 'Internal server error',
        },
      },
    },
    {
      path: '/api/changelog',
      method: 'GET',
      description: 'Get changelog entries',
      tags: ['Changelog'],
      parameters: [
        {
          name: 'limit',
          in: 'query',
          description: 'Number of entries to return',
          schema: { type: 'integer' },
        },
      ],
      responses: {
        200: {
          description: 'List of changelog entries',
        },
        500: {
          description: 'Internal server error',
        },
      },
    },
  ]);
}

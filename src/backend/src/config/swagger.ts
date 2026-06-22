import swaggerJsdoc from 'swagger-jsdoc';
import { version } from '../../package.json';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'CookSmart API Documentation',
      version: version || '1.0.0',
      description: `
# CookSmart API

Hệ thống API cho ứng dụng gợi ý món ăn thông minh CookSmart.

## Tính năng chính

- 🔐 **Authentication**: Đăng ký, đăng nhập cho User và Admin
- 🍳 **Recipe Management**: CRUD operations cho công thức nấu ăn
- 🥕 **Ingredient Management**: Quản lý nguyên liệu và danh mục
- 📄 **Pagination**: Hỗ trợ phân trang cho tất cả list endpoints
- 🔍 **Search**: Tìm kiếm công thức và nguyên liệu
- 🛡️ **Security**: JWT authentication, rate limiting, input validation
- 📦 **Response Format**: Consistent JSON response structure
- 🗜️ **Compression**: Gzip compression cho responses lớn

## Authentication

API sử dụng JWT (JSON Web Token) để authentication. Có 2 loại người dùng:

1. **User**: Người dùng thông thường (đăng ký bằng email)
2. **Admin**: Quản trị viên (đăng nhập bằng username)

### Sử dụng token

Sau khi đăng nhập, bạn sẽ nhận được access token. Sử dụng token này trong header:

\`\`\`
Authorization: Bearer <your_token_here>
\`\`\`

## Rate Limiting

- **General**: 100 requests per 15 minutes
- **Auth**: 5 requests per 15 minutes
- **Create**: 10 requests per 15 minutes

## Response Format

### Success Response
\`\`\`json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
\`\`\`

### Error Response
\`\`\`json
{
  "success": false,
  "message": "Error description",
  "error": {
    "code": "ERROR_CODE"
  }
}
\`\`\`

### Paginated Response
\`\`\`json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "currentPage": 1,
      "totalPages": 10,
      "totalItems": 100,
      "itemsPerPage": 10,
      "hasNextPage": true,
      "hasPreviousPage": false
    }
  }
}
\`\`\`
      `,
      contact: {
        name: 'CookSmart Team',
        email: 'support@cooksmart.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
      {
        url: 'https://api.cooksmart.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter JWT token (without "Bearer" prefix)',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            message: {
              type: 'string',
              example: 'Error message',
            },
            error: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  example: 'ERROR_CODE',
                },
              },
            },
          },
        },
        Pagination: {
          type: 'object',
          properties: {
            currentPage: {
              type: 'integer',
              example: 1,
            },
            totalPages: {
              type: 'integer',
              example: 10,
            },
            totalItems: {
              type: 'integer',
              example: 100,
            },
            itemsPerPage: {
              type: 'integer',
              example: 10,
            },
            hasNextPage: {
              type: 'boolean',
              example: true,
            },
            hasPreviousPage: {
              type: 'boolean',
              example: false,
            },
          },
        },
      },
      responses: {
        UnauthorizedError: {
          description: 'Access token is missing or invalid',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                success: false,
                message: 'Access denied. No token provided.',
              },
            },
          },
        },
        ForbiddenError: {
          description: 'Insufficient permissions',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                success: false,
                message: 'Admin access required.',
              },
            },
          },
        },
        NotFoundError: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                success: false,
                message: 'Resource not found',
              },
            },
          },
        },
        ValidationError: {
          description: 'Invalid input data',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                success: false,
                message: 'Validation failed',
                errors: [
                  {
                    field: 'email',
                    message: 'Please provide a valid email address',
                  },
                ],
              },
            },
          },
        },
        RateLimitError: {
          description: 'Too many requests',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                success: false,
                message: 'Too many requests, please try again later.',
              },
            },
          },
        },
      },
    },
    tags: [
      {
        name: 'Authentication',
        description: 'Đăng ký, đăng nhập và quản lý authentication',
      },
      {
        name: 'Recipes',
        description: 'Quản lý công thức nấu ăn',
      },
      {
        name: 'Ingredients',
        description: 'Quản lý nguyên liệu và danh mục',
      },
      {
        name: 'Search',
        description: 'Tìm kiếm công thức theo nguyên liệu và autocomplete',
      },
      {
        name: 'Health',
        description: 'Health check endpoints',
      },
    ],
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'], // Path to API routes
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;


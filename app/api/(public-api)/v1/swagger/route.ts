export async function GET() {

  const openApi = {
    openapi: "3.0.3",
    info: {
      title: "Quiz Qualite Public API",
      version: "1.0.0",
      description:
        "Public API v1 protected by API keys. Create quizzes and list organizations.",
    },
    servers: [
      {
        url: "/api/v1",
      },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "x-api-key",
        },
      },
      schemas: {
        QuestionInput: {
          type: "object",
          required: [
            "questionText",
            "options",
            "correctAnswer",
            "explanation",
          ],
          properties: {
            questionText: { type: "string", minLength: 1 },
            options: {
              type: "array",
              minItems: 2,
              maxItems: 8,
              items: { type: "string", minLength: 1 },
            },
            correctAnswer: {
              type: "integer",
              minimum: 0,
            },
            explanation: { type: "string", minLength: 1 },
          },
        },
        CreateQuizRequest: {
          type: "object",
          required: ["organizationId", "startDate", "endDate", "questions"],
          properties: {
            organizationId: { type: "string", minLength: 1 },
            startDate: {
              type: "string",
              pattern: "^\\d{4}-\\d{2}-\\d{2}$",
              example: "2026-07-01",
            },
            endDate: {
              type: "string",
              pattern: "^\\d{4}-\\d{2}-\\d{2}$",
              example: "2026-07-07",
            },
            questions: {
              type: "array",
              minItems: 1,
              items: { $ref: "#/components/schemas/QuestionInput" },
            },
          },
        },
      },
    },
    paths: {
      "/organizations": {
        get: {
          summary: "List organizations linked to the API key user",
          security: [{ ApiKeyAuth: [] }],
          responses: {
            "200": {
              description: "Organizations list",
            },
            "401": {
              description: "Invalid or missing API key",
            },
            "403": {
              description: "Insufficient role for public API",
            },
          },
        },
      },
      "/quizzes": {
        post: {
          summary: "Create a quiz for an organization",
          security: [{ ApiKeyAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateQuizRequest" },
              },
            },
          },
          responses: {
            "201": {
              description: "Quiz created",
            },
            "400": {
              description: "Invalid payload",
            },
            "401": {
              description: "Invalid or missing API key",
            },
            "403": {
              description:
                "API key user is not allowed to create quizzes in this organization",
            },
          },
        },
      },
    },
  };

  return Response.json(openApi);
}




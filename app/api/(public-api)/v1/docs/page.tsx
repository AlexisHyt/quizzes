import { SwaggerUiPage } from "@/app/api/(public-api)/v1/docs/swagger-ui";

export default function PublicApiDocsPage() {
  return <SwaggerUiPage specUrl="/api/v1/swagger" />;
}


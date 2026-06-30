"use client";

import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";

type SwaggerUiPageProps = {
  specUrl: string;
};

export function SwaggerUiPage({ specUrl }: SwaggerUiPageProps) {
  return (
    <div className="min-h-screen bg-white">
      <SwaggerUI url={specUrl} docExpansion="list" defaultModelsExpandDepth={1} />
    </div>
  );
}


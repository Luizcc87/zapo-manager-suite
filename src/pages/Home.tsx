import { Button } from "@evoapi/design-system/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@evoapi/design-system/card";
import { Badge } from "@evoapi/design-system/badge";
import { ArrowRight, Github, Globe, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ModeToggle } from "@/components/mode-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { useTheme } from "@/components/theme-provider";

export default function Home() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const logoSrc = isDark ? "/assets/images/zapo-manager-logo.svg" : "/assets/images/zapo-manager-logo-light.svg";

  const handleGoToManager = () => {
    navigate("/manager");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header with theme toggle */}
      <header className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center">
          <img
            src={logoSrc}
            alt="Zapo Manager"
            className="h-8"
          />
        </div>
        <div className="flex items-center gap-4">
          <LanguageToggle />
          <ModeToggle />
        </div>
      </header>

      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center mb-6">
              <img
                src={logoSrc}
                alt="Zapo Manager"
                className="h-12"
              />
            </div>
            <p className="text-xl text-muted-foreground mb-6">
              Painel de gerenciamento para a Zapo API
            </p>
            <Badge variant="secondary" className="text-sm px-3 py-1">
              Version 2.0.0
            </Badge>
          </div>

          {/* Main Card */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Bem-vindo ao Zapo Manager
              </CardTitle>
              <CardDescription>
                Painel completo para gerenciar instâncias WhatsApp via Zapo API — TCP nativo, baixo risco de ban
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="pt-6 border-t border-border">
                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                  <Button
                    onClick={handleGoToManager}
                    size="lg"
                    className="px-8 py-3"
                  >
                    Access Manager Dashboard
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Links Card */}
          <Card>
            <CardHeader>
              <CardTitle>Links</CardTitle>
              <CardDescription>
                Repositórios e recursos do projeto
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <a
                  href="https://github.com/Luizcc87/zapo-manager-suite"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-4 rounded-lg border border-border hover:bg-accent transition-colors"
                >
                  <Github className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <div className="font-medium text-foreground">Zapo Manager Suite</div>
                    <div className="text-sm text-muted-foreground">Código fonte desta suíte</div>
                  </div>
                </a>

                <a
                  href="https://github.com/vinikjkkj/zapo"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-4 rounded-lg border border-border hover:bg-accent transition-colors"
                >
                  <Globe className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <div className="font-medium text-foreground">Zapo API</div>
                    <div className="text-sm text-muted-foreground">Biblioteca WhatsApp TCP nativo</div>
                  </div>
                </a>
              </div>
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="text-center mt-12 text-sm text-muted-foreground">
            <p>© {new Date().getFullYear()} Zapo Manager · Apache 2.0 · <a href="https://github.com/Luizcc87" target="_blank" rel="noreferrer" className="underline hover:text-primary">github.com/Luizcc87</a></p>
          </div>
        </div>
      </div>
    </div>
  );
}

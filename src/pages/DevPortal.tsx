import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Globe, FileText, UserCircle, ShieldCheck, Mail } from "lucide-react";

const DevPortal = () => {
  const navigateToApp = (app: string) => {
    // En localhost, on simule le sous-domaine via un paramètre d'URL
    // App.tsx détectera ce paramètre pour charger la bonne "app"
    window.location.href = `/?app=${app}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-5xl w-full space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-gray-900">Sivara Dev Portal</h1>
          <p className="text-gray-500">Environnement de développement local. Choisissez une application à simuler.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Search Engine */}
          <Card className="hover:shadow-lg transition-all cursor-pointer border-t-4 border-t-gray-800" onClick={() => navigateToApp('www')}>
            <CardHeader>
              <div className="h-12 w-12 bg-gray-100 rounded-lg flex items-center justify-center mb-2">
                <Globe className="h-6 w-6 text-gray-700" />
              </div>
              <CardTitle>Search Engine</CardTitle>
              <CardDescription>L'application principale (sivara.ca)</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">Lancer</Button>
            </CardContent>
          </Card>

          {/* Docs */}
          <Card className="hover:shadow-lg transition-all cursor-pointer border-t-4 border-t-blue-600" onClick={() => navigateToApp('docs')}>
            <CardHeader>
              <div className="h-12 w-12 bg-blue-50 rounded-lg flex items-center justify-center mb-2">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <CardTitle>Sivara Docs</CardTitle>
              <CardDescription>L'éditeur de documents (docs.sivara.ca)</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">Lancer</Button>
            </CardContent>
          </Card>

          {/* Mail */}
          <Card className="hover:shadow-lg transition-all cursor-pointer border-t-4 border-t-orange-500" onClick={() => navigateToApp('mail')}>
            <CardHeader>
              <div className="h-12 w-12 bg-orange-50 rounded-lg flex items-center justify-center mb-2">
                <Mail className="h-6 w-6 text-orange-600" />
              </div>
              <CardTitle>Sivara Mail</CardTitle>
              <CardDescription>Messagerie sécurisée (mail.sivara.ca)</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">Lancer</Button>
            </CardContent>
          </Card>

          {/* Account */}
          <Card className="hover:shadow-lg transition-all cursor-pointer border-t-4 border-t-purple-600" onClick={() => navigateToApp('account')}>
            <CardHeader>
              <div className="h-12 w-12 bg-purple-50 rounded-lg flex items-center justify-center mb-2">
                <UserCircle className="h-6 w-6 text-purple-600" />
              </div>
              <CardTitle>Sivara Account</CardTitle>
              <CardDescription>Authentification & Profil (account.sivara.ca)</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">Lancer</Button>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-center">
            <div className="bg-white px-4 py-2 rounded-full border border-gray-200 text-sm text-gray-500 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-green-600" />
                <span>Simulation SSO active via Cookies</span>
            </div>
        </div>
      </div>
    </div>
  );
};

export default DevPortal;
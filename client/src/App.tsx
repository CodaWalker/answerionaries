import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider } from "./context/AppContext";
import { ThemeProvider } from "./hooks/use-theme";

import Header from "./components/Header";
import HomePage from "./pages/home";
import TestsPage from "./pages/tests";
import ResultsPage from "./pages/results";
import NotFound from "./pages/not-found";
import Onboarding from "./components/Onboarding";

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/tests" component={TestsPage} />
      <Route path="/results" component={ResultsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AppProvider>
          <TooltipProvider>
            <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
              <Header />
              <main className="flex-grow container mx-auto px-4 py-6">
                <Router />
              </main>
              <Toaster />
              <Onboarding />
            </div>
          </TooltipProvider>
        </AppProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;

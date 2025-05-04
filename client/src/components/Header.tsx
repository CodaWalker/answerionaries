import { useLocation } from "wouter";
import { useTheme } from "@/hooks/use-theme";
import { Button } from "@/components/ui/button";
import { Sun, Moon, Settings, ClipboardList } from "lucide-react";

const Header = () => {
  const [location, setLocation] = useLocation();
  const { theme, setTheme } = useTheme();
  
  const isActiveTab = (path: string) => {
    return location === path;
  };
  
  const navItems = [
    { path: "/", label: "Главная" },
    { path: "/tests", label: "Мои тесты" },
    { path: "/results", label: "Результаты" },
  ];
  
  return (
    <header className="bg-white dark:bg-gray-800 shadow-md px-4 py-3">
      <div className="container mx-auto">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <ClipboardList className="w-8 h-8 text-primary-600 dark:text-primary-400" />
            <h1 className="ml-2 text-xl font-semibold">TestMaster</h1>
          </div>
          
          <div className="hidden md:flex space-x-4">
            {navItems.map((item) => (
              <button
                key={item.path}
                className={`inline-block p-4 border-b-2 rounded-t-lg ${
                  isActiveTab(item.path)
                    ? "border-primary-600 text-primary-600 dark:border-primary-400 dark:text-primary-400"
                    : "border-transparent hover:text-gray-600 hover:border-gray-300 dark:hover:text-gray-300"
                }`}
                onClick={() => setLocation(item.path)}
              >
                {item.label}
              </button>
            ))}
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Переключатель темы */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {theme === "dark" ? (
                <Sun className="w-5 h-5 text-yellow-400" />
              ) : (
                <Moon className="w-5 h-5 text-gray-700" />
              )}
            </Button>
            
            {/* Кнопка настроек */}
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <Settings className="w-5 h-5" />
            </Button>
          </div>
        </div>
        
        {/* Мобильная навигация */}
        <div className="md:hidden flex justify-between mt-2 border-t border-gray-200 dark:border-gray-700 pt-2">
          {navItems.map((item) => (
            <button
              key={item.path}
              className={`flex-1 text-center py-2 ${
                isActiveTab(item.path)
                  ? "text-primary-600 font-medium dark:text-primary-400"
                  : "text-gray-600 dark:text-gray-400"
              }`}
              onClick={() => setLocation(item.path)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
};

export default Header;

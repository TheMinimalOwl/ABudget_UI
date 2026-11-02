import { Route, Routes } from 'react-router-dom';
import { MobileNav, Sidebar } from './components/layout';
import { Dashboard } from './pages/Dashboard';
import { Placeholder } from './pages/Placeholder';
import { Transactions } from './pages/Transactions';

export function App() {
  return (
    <div className="flex min-h-screen bg-canvas text-ink">
      <Sidebar />
      <main className="mx-auto w-full max-w-[1500px] flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-9 lg:pb-8 lg:pt-8">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/movimientos" element={<Transactions />} />
          <Route
            path="/presupuesto"
            element={
              <Placeholder
                eyebrow="Fase 2"
                title="Presupuesto"
                subtitle="Sobres, asignaciones y disponible para el próximo mes."
                description="La vista mensual por grupos y categorías llegará cuando activemos la escritura. En el resumen ya puedes ver el disponible y cuánto has gastado."
              />
            }
          />
          <Route
            path="/informes"
            element={
              <Placeholder
                eyebrow="Fase 3"
                title="Informes"
                subtitle="Flujo de caja, gasto por categoría y patrimonio."
                description="Los agregados ya se calculan en el BFF. Esta sección añadirá filtros por rango, comparativas entre meses y exportación."
              />
            }
          />
          <Route
            path="/ajustes"
            element={
              <Placeholder
                eyebrow="Sistema"
                title="Ajustes"
                subtitle="Conexión, sincronización y preferencias."
                description="Aquí verás el estado de la conexión con Actual, la antigüedad del último sync y las preferencias de formato. Las mutaciones siguen desactivadas en esta versión."
              />
            }
          />
        </Routes>
      </main>
      <MobileNav />
    </div>
  );
}

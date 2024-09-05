// middleware/planCheck.js
const planCheck = (requiredPlan) => {
    return (req, res, next) => {
      const userPlan = req.user.plan;
      const planHierarchy = ['gratuito', 'plus', 'premium'];
      
      if (planHierarchy.indexOf(userPlan) >= planHierarchy.indexOf(requiredPlan)) {
        next();
      } else {
        const html = `
          <!DOCTYPE html>
          <html lang="pt-BR" data-theme="purple">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Acesso Negado</title>
            <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
            <link href="https://cdn.jsdelivr.net/npm/daisyui@2.20.0/dist/full.css" rel="stylesheet" type="text/css" />
            <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap" rel="stylesheet">
            <style>
              body {
                font-family: 'Roboto', sans-serif;
              }
            </style>
          </head>
          <body>
            <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-500 to-indigo-500">
              <div class="max-w-md w-full bg-white rounded-lg shadow-lg p-8 animate-fade-in">
                <div class="text-center">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-24 w-24 mx-auto text-red-500 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h1 class="text-3xl font-bold text-red-500 mt-4">Acesso Negado</h1>
                  <p class="text-gray-600 mt-2">Desculpe, você não tem permissão para acessar este recurso.</p>
                </div>
                <div class="mt-6 bg-gray-100 rounded-lg p-4">
                  <p class="font-bold text-purple-600">Plano Requerido: <span class="text-purple-800">${requiredPlan}</span></p>
                  <p class="font-bold text-purple-600 mt-2">Seu Plano Atual: <span class="text-purple-800">${userPlan}</span></p>
                </div>
                <div class="mt-8 flex justify-between">
                  <a href="/change-plan" class="btn btn-primary">Assinar Plano</a>
                  <a href="/dashboard" class="btn btn-outline">Voltar ao Dashboard</a>
                </div>
              </div>
            </div>
          </body>
          </html>
        `;
        
        res.status(403).send(html);
      }
    };
  };
  
  module.exports = planCheck;
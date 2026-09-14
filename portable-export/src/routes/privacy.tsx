import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  ssr: false,
  component: PrivacyPolicy,
  head: () => ({
    meta: [
      { title: "Política de Privacidad | VIP Remesas" },
      {
        name: "description",
        content: "Política de privacidad de VIP Remesas.",
      },
    ],
  }),
});

function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
        <Link to="/" className="text-sm font-semibold text-gold hover:opacity-80">
          ← Volver a VIP Remesas
        </Link>

        <article className="mt-8 space-y-8">
          <header>
            <h1 className="font-display text-3xl font-bold sm:text-4xl">Política de Privacidad</h1>
            <p className="mt-2 text-sm text-muted-foreground">Última actualización: 14 de septiembre de 2026</p>
          </header>

          <section className="space-y-3">
            <h2 className="text-xl font-bold">1. Responsable y contacto</h2>
            <p>
              Esta Política de Privacidad explica cómo VIP Remesas trata la información personal
              cuando utilizas nuestro sitio web y sus servicios. Para consultas relacionadas con
              privacidad puedes escribir a <strong>leandrorodriguezsarmiento@gmail.com</strong>.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold">2. Información que podemos recopilar</h2>
            <p>Dependiendo de las funciones que utilices, podemos tratar:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>Datos de cuenta, como nombre y correo electrónico.</li>
              <li>Información necesaria para procesar solicitudes y operaciones que realices dentro del servicio.</li>
              <li>Información técnica básica, como navegador, dispositivo, dirección IP y registros de seguridad cuando sea necesario para operar y proteger el servicio.</li>
              <li>Preferencias y datos de sesión necesarios para mantener tu cuenta iniciada.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold">3. Inicio de sesión con Google</h2>
            <p>
              Puedes iniciar sesión mediante Google. En ese caso, Google nos proporciona los datos
              de perfil autorizados por ti, como tu nombre y dirección de correo electrónico, para
              crear o acceder a tu cuenta. El uso de Google está sujeto a las políticas de Google.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold">4. Para qué utilizamos la información</h2>
            <ul className="list-disc space-y-2 pl-6">
              <li>Crear y administrar tu cuenta.</li>
              <li>Prestar las funciones que solicites dentro de VIP Remesas.</li>
              <li>Procesar y consultar solicitudes, recargas u otras operaciones disponibles.</li>
              <li>Enviar comunicaciones relacionadas con tu cuenta o con una operación solicitada.</li>
              <li>Prevenir fraude, abuso y accesos no autorizados.</li>
              <li>Mejorar la seguridad, funcionamiento y experiencia del sitio.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold">5. Servicios tecnológicos</h2>
            <p>
              VIP Remesas utiliza proveedores tecnológicos para alojar, autenticar, almacenar o
              procesar información necesaria para prestar el servicio. Estos proveedores solo deben
              recibir la información necesaria para las funciones correspondientes y están sujetos a
              sus propias condiciones y políticas de privacidad.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold">6. Conservación y seguridad</h2>
            <p>
              Conservamos la información durante el tiempo necesario para prestar el servicio,
              cumplir obligaciones aplicables, resolver disputas y proteger nuestros derechos. Tomamos
              medidas técnicas y organizativas razonables para proteger la información frente a acceso,
              alteración, pérdida o divulgación no autorizados.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold">7. Tus derechos y solicitudes</h2>
            <p>
              Puedes solicitar información sobre los datos personales asociados a tu cuenta y pedir,
              cuando corresponda, su corrección o eliminación. Para realizar una solicitud, contacta
              con nosotros mediante el correo indicado en esta política. Podremos pedir información
              adicional para verificar tu identidad antes de atender una solicitud.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold">8. Cambios en esta política</h2>
            <p>
              Podemos actualizar esta Política de Privacidad cuando cambien nuestros servicios,
              prácticas o requisitos legales. Publicaremos la versión actualizada en esta página y
              modificaremos la fecha de actualización.
            </p>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-lg font-bold">Contacto</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              VIP Remesas · leandrorodriguezsarmiento@gmail.com
            </p>
          </section>
        </article>
      </div>
    </main>
  );
}

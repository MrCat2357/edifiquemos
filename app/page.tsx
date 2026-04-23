export default function Home() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">
        Bem-vindo ao acervo de sermões
      </h1>

      <p className="text-gray-600">
        Encontre sermões, estudos e artigos de diferentes denominações.
      </p>

      <a
        href="/posts"
        className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      >
        Ver posts
      </a>
    </div>
  );
}
export default function Posts() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Posts</h1>

      {/* Post exemplo 1 */}
      <div className="border p-4 rounded hover:shadow">
        <h2 className="text-lg font-semibold">A importância da fé</h2>
        <p className="text-sm text-gray-500">
          Pr. João • 10/04/2026
        </p>
      </div>

      {/* Post exemplo 2 */}
      <div className="border p-4 rounded hover:shadow">
        <h2 className="text-lg font-semibold">Vivendo o evangelho</h2>
        <p className="text-sm text-gray-500">
          Pe. Marcos • 08/04/2026
        </p>
      </div>

      {/* Post exemplo 3 */}
      <div className="border p-4 rounded hover:shadow">
        <h2 className="text-lg font-semibold">Esperança em tempos difíceis</h2>
        <p className="text-sm text-gray-500">
          Pr. Lucas • 05/04/2026
        </p>
      </div>
      <a href="/perfil" className="text-blue-500">
        Meu perfil
      </a>
    </div>
  );
}
import { useState } from "react";
export default function FurnitureSources() {
  const [search, setSearch] = useState("sofa");
  return (
    <section className="furniture-sources">
      <h3>Trouver un vrai meuble 3D</h3>
      <p>
        Recherchez un modèle, téléchargez sa version GLB ou glTF, puis déposez
        le fichier ou le ZIP ici.
      </p>
      <label className="field">
        Que cherchez-vous ?
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="sofa, chair, bed…"
        />
      </label>
      <div className="source-links">
        <a
          target="_blank"
          rel="noreferrer"
          href={
            "https://sketchfab.com/search?type=models&features=downloadable&q=" +
            encodeURIComponent(search)
          }
        >
          Sketchfab ↗
          <small>Modèles téléchargeables · compte parfois nécessaire</small>
        </a>
        <a target="_blank" rel="noreferrer" href="https://polyhaven.com/models">
          Poly Haven ↗<small>Modèles CC0 · choisir glTF si proposé</small>
        </a>
      </div>
      <small>
        Vérifiez le format et la licence sur le site source. Une page produit
        IKEA est une référence, pas un fichier 3D. Aucun compte de ces sites
        n’est connecté à Roomora.
      </small>
    </section>
  );
}

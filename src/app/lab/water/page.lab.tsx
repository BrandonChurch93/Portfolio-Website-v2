import type { Metadata } from 'next';
import { site } from '../../../content/site';
import { WaterLab } from '../../../components/lab/WaterLab';
import page from '../../../components/Page.module.css';

// Exists only while SHOW_LAB is on. Every move of the water alone, on one route.
export const metadata: Metadata = { title: `${site.meta.lab.title} · ${site.lab.water}`, description: site.meta.lab.description, robots: { index: false } };

export default function LabWater() {
  return (
    <main id="main" className={page.main}>
      <div className={page.wrap}>
        <h1 className="visually-hidden">{site.lab.water}</h1>
        <WaterLab />
      </div>
    </main>
  );
}

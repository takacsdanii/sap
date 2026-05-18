# Projekt Dokumentáció: AI-Powered Incident Analyzer
**Készítette:** Takács Dániel Attila, FGHJG9

**Technológia:** SAP BTP, CAP Model, HANA Vector Engine, SAPUI5

**Környezet:** SAP BTP Trial

## 1. A projekt célja
A projekt egy teljes körű, mesterséges intelligenciával támogatott incidenskezelő rendszer megvalósítása volt az SAP BTP platformján. A cél a manuális ügyfélszolgálati munka minimalizálása modern technológiák (LLM, Vektoros keresés) ötvözésével, miközben a rendszer teljes mértékben megfelel a "Clean Core" irányelveknek.

## 2. Megvalósult funkciók és modulok
- Intelligens Adatmodell és Integráció: A Kaggle-alapú Customer Support Tickets 
(https://www.kaggle.com/datasets/suraj520/customer-support-ticket-dataset) adathalmaz sikeres integrálása. Az adatmodell (CDS) már nemcsak a tranzakcionális adatokat, hanem az AI-metaadatokat és vektor-embeddingeket is kezeli.
- AI-vezérelt Kategorizálás: A Google Gemini API segítségével a rendszer automatikusan meghatározza a beérkező hibajegyek típusát és sürgősségét a leírás alapján, az eredményt visszaírva az adatbázisba.
- Automata Választervezet-generálás: Személyre szabott, kontextusfüggő válaszok generálása az ügyfelek számára, csökkentve az adminisztrációs terheket. A generálás előtt a rendszer hasonló, korábban megoldott jegyeket keres és azokat kontextusként adja át a modellnek.
- Vektoros keresés és RAG (Retrieval-Augmented Generation): A rendszer a korábbi megoldott incidenseket a Gemini Embedding API segítségével vektorizálja, és a HANA Cloud Vector Engine-ben tárolja. Új hiba esetén cosinus-hasonlóság alapján szemantikus keresést végez, és felajánlja a leginkább hasonló múltbeli megoldásokat.
- SAPUI5 felhasználói felület: Egy freestyle SAPUI5 alkalmazás készült, amelyben a diszpécserek egy központi nézetben látják az összes hibajegyet, az AI által generált összefoglalókat, urgenciát és javasolt válaszokat, illetve közvetlenül a felületről indíthatják az AI-funkciókat.


## 3. Alkalmazott technológiák
A megvalósítás során kizárólag ingyenes (Free/Trial) szolgáltatásokat használtam:
- Backend: Node.js alapú CAP (Cloud Application Programming Model), bound action-ök és db.run() minták alkalmazásával.
- Adatbázis: SAP HANA Cloud (a beépített Vector Engine-nel); lokális fejlesztéshez SQLite.
- AI: Google Gemini API (gemini-2.0-flash szöveggeneráláshoz, gemini-embedding-001 vektorizáláshoz).
- Frontend: Freestyle SAPUI5 SplitApp, annotáció nélküli, programozott UI-logikával.
- Deployment: MTA-alapú Cloud Foundry telepítés SAP BTP Trial környezetbe (US10 régió).

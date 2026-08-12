// ===================== BANNER OFFERTE (collegato a Google Sheets) =====================
// Colonne attese nel foglio: nome | descrizione | prezzo_originale | prezzo_scontato | immagine
// - 0 offerte valide (nome + prezzo_scontato presenti) -> sezione #offerte nascosta
// - 1 offerta valida  -> vista statica (.offerta-single)
// - 2+ offerte valide -> carosello Bootstrap AUTOMATICO (autoplay) con
//   dissolvenza incrociata: scorre da solo ogni 4 secondi, senza frecce
//   ma con piccole barrette-indicatore in basso (anche cliccabili)
// Il fetch ha un timeout di 6 secondi: se il foglio non risponde in tempo
// (rete lenta/assente) la sezione si nasconde da sola invece di restare
// "appesa" a caricare indefinitamente.
document.addEventListener("DOMContentLoaded", function () {
    const csvUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSIt-Tmv4CI5WXmuxYS7VH0VLQiYvQ39N9Tqgbcw3ssjOCbb7Tqct8OWkB7WawvNgpsNgZ45STGCczl/pub?gid=0&single=true&output=csv";
    const offerteContainer = document.getElementById("offerte");

    if (!offerteContainer) return;

    const controller = new AbortController();
    const timeoutId = setTimeout(function () { controller.abort(); }, 6000);

    fetch(csvUrl, { signal: controller.signal })
        .then(function (res) { return res.text(); })
        .then(function (csvText) {
            clearTimeout(timeoutId);
            const results = Papa.parse(csvText, { header: true });
            gestisciOfferte(results.data);
        })
        .catch(function (error) {
            clearTimeout(timeoutId);
            console.error("Errore nel caricamento del CSV offerte:", error);
            offerteContainer.style.display = "none";
        });

    function gestisciOfferte(data) {
        // Richiede SOLO nome e prezzo_scontato (immagine e descrizione opzionali)
        const offerte = data.filter(function (p) {
            const hasNome = p.nome && p.nome.trim() !== "";
            const hasPrezzo = p.prezzo_scontato && p.prezzo_scontato.trim() !== "";
            return hasNome && hasPrezzo;
        });

        if (offerte.length === 0) {
            offerteContainer.style.display = "none";
            return;
        }

        if (offerte.length === 1) {
            renderSingolaOfferta(offerte[0], offerteContainer);
            return;
        }

        renderCarousel(offerte, offerteContainer);
    }

    // Temi colore per lo sfondo a tinta unita della card: ruotano nell'ordine
    // blu -> rosso -> grigio -> blu... in base all'indice dell'offerta.
    // Una singola offerta è sempre in tema blu (indice 0).
    const TEMI = ["offerta-tema-blu", "offerta-tema-rosso", "offerta-tema-grigio"];
    function temaPerIndice(i) {
        return TEMI[i % TEMI.length];
    }

    // Calcola la percentuale di sconto da prezzo_originale e prezzo_scontato.
    // Gestisce sia "199.90" che "199,90". Ritorna null se il calcolo non è
    // sensato (prezzo originale mancante, non numerico, o non superiore allo scontato).
    function calcolaScontoPercentuale(prezzoOriginale, prezzoScontato) {
        const o = parseFloat(String(prezzoOriginale || "").replace(",", "."));
        const s = parseFloat(String(prezzoScontato || "").replace(",", "."));
        if (!isFinite(o) || !isFinite(s) || o <= 0 || s <= 0 || o <= s) return null;
        return Math.round((1 - s / o) * 100);
    }

    function badgeScontoHTML(p) {
        const perc = calcolaScontoPercentuale(p.prezzo_originale, p.prezzo_scontato);
        if (perc === null) return "";
        return `
            <div class="sconto-badge">
                <span class="sconto-badge-text">-${perc}%</span>
            </div>
        `;
    }

    // Niente placeholder esterno (via.placeholder.com e simili): se manca
    // l'URL immagine nel foglio, semplicemente non mettiamo <img> e resta
    // il riquadro colorato del tema. Zero richieste di rete inutili.
    // Se invece l'URL c'e' ma e' rotto o non e' un link diretto a
    // un'immagine, l'onerror nasconde l'<img> invece di mostrare
    // l'icona di immagine rotta.
    function mediaHTML(p) {
        const haImmagine = p.immagine && p.immagine.trim() !== "";
        const img = haImmagine
            ? `<img src="${p.immagine.trim()}" alt="${p.nome}" loading="eager" onerror="this.remove()">`
            : "";
        return `
            <div class="offerta-media">
                ${img}
                ${badgeScontoHTML(p)}
            </div>
        `;
    }

    function contentHTML(p) {
        // Il prezzo barrato compare SOLO se nel foglio c'e' davvero un
        // prezzo originale: prima usciva un "€" orfano quando mancava.
        const haOriginale = p.prezzo_originale && String(p.prezzo_originale).trim() !== "";
        const oldPrice = haOriginale
            ? `<span class="old-price">${String(p.prezzo_originale).trim()}€</span>`
            : "";
        const descrizione = p.descrizione && p.descrizione.trim() !== ""
            ? `<p class="offerta-descrizione">${p.descrizione.trim()}</p>`
            : "";
        return `
            <div class="offerta-content">
                <h2>${p.nome}</h2>
                ${descrizione}
                <div class="prezzi">
                    ${oldPrice}
                    <span class="new-price">${String(p.prezzo_scontato).trim()}€</span>
                </div>
                <p class="offerta-cta-testo">Passa in negozio</p>
            </div>
        `;
    }

    // L'etichetta "Offerte" e' un piccolo eyebrow elegante con due
    // lineette laterali (non piu' un titolone), mentre la chiamata
    // all'azione e' un vero bottone dentro il blocco testo (vedi
    // contentHTML): gerarchia visiva da vetrina, non da volantino.
    function cardHTML(p) {
        return `
            <p class="offerte-eyebrow"><span>Offerte</span></p>
            <div class="offerta-riga">
                ${mediaHTML(p)}
                ${contentHTML(p)}
            </div>
        `;
    }

    function renderSingolaOfferta(p, container) {
        container.innerHTML = `
            <div class="offerta-single ${temaPerIndice(0)}">
                ${cardHTML(p)}
            </div>
        `;
    }

    function renderCarousel(offerte, container) {
        // "carousel-fade": le offerte si sostituiscono con una dissolvenza
        // incrociata invece dello scivolamento laterale — piu' morbido su
        // un banner a tutta larghezza. Le barrette in basso (indicatori)
        // fanno capire a colpo d'occhio quante offerte ci sono e a che
        // punto siamo; restano anche cliccabili.
        container.innerHTML = `
            <div id="carouselOfferte" class="carousel slide carousel-fade" data-bs-ride="carousel">
                <div class="carousel-inner">
                    ${offerte.map(function (p, i) {
                        return `
                            <div class="carousel-item ${i === 0 ? "active" : ""}">
                                <div class="offerta-slide ${temaPerIndice(i)}">
                                    ${cardHTML(p)}
                                </div>
                            </div>
                        `;
                    }).join("")}
                </div>
                <div class="carousel-indicators">
                    ${offerte.map(function (p, i) {
                        return `
                            <button type="button" data-bs-target="#carouselOfferte"
                                    data-bs-slide-to="${i}"
                                    class="${i === 0 ? "active" : ""}"
                                    aria-label="Offerta ${i + 1}"
                                    ${i === 0 ? 'aria-current="true"' : ""}></button>
                        `;
                    }).join("")}
                </div>
            </div>
        `;

        try {
            const carouselElement = document.getElementById("carouselOfferte");
            new bootstrap.Carousel(carouselElement, {
                interval: 4000,
                wrap: true,
                pause: false,   // scorrimento sempre attivo, anche al passaggio del mouse
                touch: false    // niente trascinamento manuale: solo automatico
            });
        } catch (error) {
            console.error("Errore nell'inizializzazione del carousel offerte:", error);
        }
    }
});

document.addEventListener('DOMContentLoaded', function () {
    const track = document.getElementById('prodottiTrack');
    const prevBtn = document.getElementById('prodottiPrev');
    const nextBtn = document.getElementById('prodottiNext');
    const dotsContainer = document.getElementById('prodottiDots');

    if (!track || !prevBtn || !nextBtn || !dotsContainer) return;

    const cards = Array.from(track.querySelectorAll('.asko-carousel-card'));
    const totalCards = cards.length;

    // Quante card si vedono "a colpo d'occhio" alle diverse larghezze.
    // Sono numeri interi apposta: con i numeri decimali di prima l'ultima
    // slide poteva calcolare uno scorrimento oltre l'ultima card reale,
    // mostrando uno spazio vuoto (il bug delle "slide fantasma").
    function getCardsPerView() {
        const w = window.innerWidth;
        if (w <= 767) return 1;
        if (w <= 991) return 2;
        return 3;
    }

    let cardsPerView = getCardsPerView();
    let totalSlides = Math.ceil(totalCards / cardsPerView);
    let currentSlide = 0;

    function maxScrollLeft() {
        return track.scrollWidth - track.clientWidth;
    }

    // Posizione di scroll reale per raggiungere una data slide, mai oltre
    // il massimo scorribile: è questo il fix del bug della slide fantasma.
    function scrollTargetForSlide(index) {
        const cardIndex = Math.min(index * cardsPerView, totalCards - 1);
        const card = cards[cardIndex];
        if (!card) return 0;
        return Math.min(card.offsetLeft, maxScrollLeft());
    }

    function createDots() {
        dotsContainer.innerHTML = '';
        for (let i = 0; i < totalSlides; i++) {
            const dot = document.createElement('button');
            dot.classList.add('asko-carousel-dot');
            if (i === 0) dot.classList.add('active');
            dot.dataset.index = i;
            dot.addEventListener('click', function () {
                goToSlide(parseInt(this.dataset.index, 10));
            });
            dotsContainer.appendChild(dot);
        }
    }

    function updateUI() {
        document.querySelectorAll('.asko-carousel-dot').forEach(function (dot, i) {
            dot.classList.toggle('active', i === currentSlide);
        });
        prevBtn.classList.toggle('visible', currentSlide > 0);
        nextBtn.classList.toggle('hidden', currentSlide >= totalSlides - 1);
    }

    function goToSlide(index) {
        if (index < 0) index = 0;
        if (index >= totalSlides) index = totalSlides - 1;
        currentSlide = index;
        track.scrollTo({ left: scrollTargetForSlide(index), behavior: 'smooth' });
        updateUI();
    }

    function nextSlide() {
        if (currentSlide < totalSlides - 1) goToSlide(currentSlide + 1);
    }

    function prevSlide() {
        if (currentSlide > 0) goToSlide(currentSlide - 1);
    }

    nextBtn.addEventListener('click', nextSlide);
    prevBtn.addEventListener('click', prevSlide);

    // Mentre l'utente scorre col dito (o col mouse), teniamo aggiornato
    // il puntino attivo confrontando la posizione di scroll reale con
    // quella di ogni slide. Aggiorniamo ad ogni frame (non solo quando lo
    // scroll si ferma) così il puntino segue il dito in tempo reale.
    let ticking = false;
    function syncActiveDotWithScroll() {
        const scrollLeft = track.scrollLeft;
        let nearestSlide = 0;
        let smallestDiff = Infinity;
        for (let i = 0; i < totalSlides; i++) {
            const diff = Math.abs(scrollTargetForSlide(i) - scrollLeft);
            if (diff < smallestDiff) {
                smallestDiff = diff;
                nearestSlide = i;
            }
        }
        if (nearestSlide !== currentSlide) {
            currentSlide = nearestSlide;
            updateUI();
        }
        ticking = false;
    }

    track.addEventListener('scroll', function () {
        if (!ticking) {
            requestAnimationFrame(syncActiveDotWithScroll);
            ticking = true;
        }
    });

    let resizeTimeout;
    window.addEventListener('resize', function () {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(function () {
            const newCardsPerView = getCardsPerView();
            if (newCardsPerView !== cardsPerView) {
                cardsPerView = newCardsPerView;
                totalSlides = Math.ceil(totalCards / cardsPerView);
                if (currentSlide >= totalSlides) currentSlide = totalSlides - 1;
                createDots();
            }
            goToSlide(currentSlide);
        }, 200);
    });

    createDots();
    updateUI();
});

// Pagine prodotto: rivela ogni riga "tipologia" con un leggero fade+salita
// quando entra nello schermo scorrendo (si ferma da sola dopo la prima volta).
document.addEventListener('DOMContentLoaded', function () {
    const rows = document.querySelectorAll('.tipologia-row');
    if (!rows.length) return;

    if (!('IntersectionObserver' in window)) {
        rows.forEach(function (row) { row.classList.add('is-visible'); });
        return;
    }

    const observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15 });

    rows.forEach(function (row) { observer.observe(row); });
});

// Chiude automaticamente il menu ad hamburger dopo aver cliccato una voce
document.addEventListener('DOMContentLoaded', function () {
    const navbarCollapseEl = document.getElementById('navbarNav');
    if (!navbarCollapseEl || typeof bootstrap === 'undefined') return;

    const navLinks = navbarCollapseEl.querySelectorAll('.nav-link');
    navLinks.forEach(function (link) {
        link.addEventListener('click', function () {
            if (navbarCollapseEl.classList.contains('show')) {
                bootstrap.Collapse.getOrCreateInstance(navbarCollapseEl).hide();
            }
        });
    });
});

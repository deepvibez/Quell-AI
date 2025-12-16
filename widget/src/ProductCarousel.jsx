import React, { useRef } from "react";

/**
 * ProductCarousel
 * Props:
 * - products
 * - primaryColor
 * - onShowDetails(productIdx)
 * - detailsOpen (object)
 * - onStartAddToCart(productIdx)
 * - cartOpen (object)
 * - storeUrl (optional)
 */
export default function ProductCarousel({
  products,
  primaryColor,
  onShowDetails,
  detailsOpen,
  onStartAddToCart,
  cartOpen,
  storeUrl,
}) {
  const carouselRef = useRef();
  const scrollByAmount = 230;

  const scrollLeft = () => {
    if (carouselRef.current)
      carouselRef.current.scrollBy({ left: -scrollByAmount, behavior: "smooth" });
  };
  const scrollRight = () => {
    if (carouselRef.current)
      carouselRef.current.scrollBy({ left: scrollByAmount, behavior: "smooth" });
  };

  if (!products || !products.length) return null;

  const buildProductLink = (product) => {
    if (!product) return null;
    if (product.productUrl) return product.productUrl;
    if (product.url) return product.url;
    if (product.handle) {
      if (storeUrl) return `${storeUrl.replace(/\/$/, "")}/products/${product.handle}`;
      return `/products/${product.handle}`;
    }
    return null;
  };

  return (
    <div className="carousel-wrapper">
      <button className="arrow left" onClick={scrollLeft} aria-label="Scroll Left">
        ‹
      </button>

      <div ref={carouselRef} className="product-carousel">
        {products.map((product, idx) => {
          const productLink = buildProductLink(product);
          const isAvailable = product.available !== false; // treat undefined/true as available

          return (
            <div key={idx} className="product-card-compact" style={{ ["--i"]: idx }}>
              <div className="product-compact-view">
                <div className="product-image-wrapper">
                  <img src={product.imageUrl} alt={product.title || ""} />
                  {product.available === false && (
                    <div className="product-badge out-of-stock">Out of Stock</div>
                  )}

                  {productLink && (
                    <a
                      className="product-view-link"
                      href={productLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="View product on store"
                    >
                      ⤴
                    </a>
                  )}
                </div>

                <div className="product-compact-info">
                  <div className="product-title-compact">{product.title}</div>
                  <div className="product-price-compact">{product.price}</div>
                </div>

                <div className="product-compact-actions">
                  <button
                    className="compact-btn primary"
                    style={{ background: primaryColor }}
                    onClick={() => onStartAddToCart(idx)}
                    disabled={!isAvailable}
                    aria-disabled={!isAvailable}
                    title={isAvailable ? "Add to Cart" : "Out of stock"}
                  >
                    {isAvailable ? "Add to Cart" : "Out of stock"}
                  </button>

                  <button
                    className="compact-btn secondary"
                    onClick={() => onShowDetails(idx)}
                  >
                    {detailsOpen && detailsOpen[idx] ? "Hide details ▲" : "Show details ▼"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <button className="arrow right" onClick={scrollRight} aria-label="Scroll Right">
        ›
      </button>
    </div>
  );
}

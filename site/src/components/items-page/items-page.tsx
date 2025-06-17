import { type ReactElement, Fragment } from "react";
import { SearchElement } from "../search-element/search-element";
import "./items-page.css";
import type { GEPrices, ItemsView, MemberName } from "../../data/api";
import type { ItemData } from "../../data/item-data";

const ItemPanel = ({
  itemName,
  highAlch,
  gePrice,
  imageURL,
  totalQuantity,
  quantities,
}: {
  itemName: string;
  highAlch: number;
  gePrice: number;
  imageURL: string;
  totalQuantity: number;
  quantities: Map<MemberName, number>;
}): ReactElement => {
  const quantityBreakdown = [...quantities].map(([name, quantity]: [MemberName, number]) => {
    const className = quantity <= 0 ? "inventory-item__no-quantity" : "";
    const quantityPercent = (quantity / totalQuantity) * 100;
    return (
      <Fragment key={name}>
        <span className={className}>{name}</span>
        <span>{quantity}</span>
        <div
          className="inventory-item__quantity-bar"
          style={{ transform: `scaleX(${quantityPercent}%)`, background: `hsl(${quantityPercent}, 100%, 40%)` }}
        ></div>
      </Fragment>
    );
  });

  return (
    <div className="inventory-item rsborder rsbackground rendered">
      <div className="inventory-item__top rsborder-tiny">
        <div className="inventory-item__top-right">
          <div className="inventory-item__name">
            <a className="rstext" href="${item.wikiLink}" target="_blank">
              {itemName}
            </a>
          </div>
          <div className="inventory-item__details">
            <span>Quantity</span>
            <span>{totalQuantity.toLocaleString()}</span>
            <span>High Alch</span>
            <span>{highAlch.toLocaleString()}</span>
            <span>GE Price</span>
            <span>{gePrice.toLocaleString()}</span>
          </div>
        </div>

        <div className="inventory-item__picture-container">
          <img
            loading="lazy"
            alt={itemName ?? "An unknown item"}
            className="inventory-item__picture"
            src={imageURL}
            width="63"
            height="56"
          />
        </div>
      </div>
      <div className="inventory-item__bottom">{quantityBreakdown}</div>
    </div>
  );
};

export const ItemsPage = ({
  items,
  itemData,
  gePrices,
}: {
  items?: ItemsView;
  itemData?: ItemData;
  gePrices?: GEPrices;
}): ReactElement => {
  const itemComponents: ReactElement[] = [];
  let totalItems = 0;
  let totalHighAlch = 0;
  let totalGEPrice = 0;
  if (items !== undefined) {
    items.forEach((quantityByMemberName, itemID) => {
      const item = itemData?.get(itemID);

      let totalQuantity = 0;
      quantityByMemberName.forEach((quantity) => {
        totalQuantity += quantity;
      });

      const highAlch = item?.highalch ?? 0;
      const gePrice = gePrices?.get(itemID) ?? 0;
      totalItems += 1;
      totalHighAlch += totalQuantity * highAlch;
      totalGEPrice += totalQuantity * gePrice;

      itemComponents.push(
        <ItemPanel
          key={itemID}
          imageURL={`/icons/items/${itemID}.webp`}
          totalQuantity={totalQuantity}
          highAlch={highAlch}
          gePrice={gePrice}
          itemName={item?.name ?? "UNKNOWN"}
          quantities={quantityByMemberName}
        />,
      );
    });
  }

  return (
    <>
      <div className="items-page__head">
        <SearchElement className="items-page__search" placeholder="Search" auto-focus />
      </div>
      <div className="items-page__utility">
        <div className="men-control-container rsborder-tiny rsbackground rsbackground-hover">
          <select className="items-page__sort">
            <option value="totalquantity">Sort: Total Quantity</option>
            <option value="highalch">Sort: High Alch</option>
            <option value="geprice">Sort: GE Price</option>
            <option value="alphabetical">Sort: Alphabetical</option>
          </select>
        </div>
        <div className="men-control-container rsborder-tiny rsbackground rsbackground-hover">
          <select className="items-page__player-filter"></select>
        </div>
        <div className="men-control-container rsborder-tiny rsbackground rsbackground-hover">
          <input type="checkbox" id="items-page__individual-items" />
          <label htmlFor="items-page__individual-items">Individual item price</label>
        </div>
        <span className="men-control-container rsborder-tiny rsbackground rsbackground-hover">
          <span className="items-page__item-count">{totalItems.toLocaleString()}</span>&nbsp;<span>items</span>
        </span>
        <span className="men-control-container rsborder-tiny rsbackground rsbackground-hover">
          HA:&nbsp;<span className="items-page__total-ha-price">{totalHighAlch.toLocaleString()}</span>
          <span>gp</span>
        </span>
        <span className="men-control-container rsborder-tiny rsbackground rsbackground-hover">
          GE:&nbsp;<span className="items-page__total-ge-price">{totalGEPrice.toLocaleString()}</span>
          <span>gp</span>
        </span>
      </div>
      <section className="items-page__list">{itemComponents}</section>
    </>
  );
};

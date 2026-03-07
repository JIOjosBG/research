from PIL import Image
from datetime import datetime
import os
from dotenv import load_dotenv
import requests
from io import BytesIO

load_dotenv()  # load variables from .env


def set_slack_profile_pic(image: Image.Image):
    """
    Set Slack profile picture from a PIL Image object.
    """
    token = os.getenv("SLACK_TOKEN")
    if not token:
        raise ValueError("SLACK_TOKEN not found in .env")

    url = "https://slack.com/api/users.setPhoto"

    # Convert PIL Image to bytes
    buf = BytesIO()
    image.save(buf, format="PNG")
    buf.seek(0)

    response = requests.post(
        url,
        headers={"Authorization": f"Bearer {token}"},
        files={"image": ("profile.png", buf, "image/png")},
    )

    data = response.json()
    if not data.get("ok"):
        raise RuntimeError(f"Error setting profile pic: {data.get('error')}")
    return "Profile picture updated successfully"


def getRegionFromRatio(r):
    p = 100 * r
    x = 0
    y = 0
    pxPerPercentage = 28.8
    sideSlidePercentage = (1440 - 205) / pxPerPercentage  # 42.88
    if p < sideSlidePercentage:
        x = p * 28.8
        y = 205
    elif p < 50:
        x = 1440 - 205
        y = (205) - (p - sideSlidePercentage) * pxPerPercentage
    elif p < 50 + sideSlidePercentage:
        x = (1440 - 205) - (p - 50) * pxPerPercentage
        y = 0
    else:
        x = 0
        y = (p - 50 - sideSlidePercentage) * pxPerPercentage

    x = int(x)
    y = int(y)
    return (x, y, x + 205, y + 205)


def main():

    day_of_year = datetime.now().timetuple().tm_yday

    # for i in range(1000):
    base = Image.open("background.jpg")  # background image
    overlay = Image.open("me.jpg")

    crop_box = getRegionFromRatio(day_of_year / 365)
    # crop_box = getRegionFromRatio((i/100)%1)
    cropped = base.crop(crop_box)
    overlay = overlay.resize(cropped.size)
    base.paste(overlay, crop_box, overlay)

    region = base.crop(crop_box)
    set_slack_profile_pic(region)


if __name__ == "__main__":
    main()

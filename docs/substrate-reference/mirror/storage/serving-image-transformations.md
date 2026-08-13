<!-- source: https://supabase.com/docs/guides/storage/serving/image-transformations · mirrored 2026-08-13 from Supabase docs -->

# Storage Image Transformations

Transform images with Storage

Supabase Storage offers the functionality to optimize and resize images on the fly. Any image stored in your buckets can be transformed and optimized for fast delivery.

Note: Image Resizing is currently enabled for [Pro Plan and above](https://supabase.com/pricing).

## Manage image transformations

You can enable or disable Image Transformations for your project from the [**Storage** > **Settings**](https://supabase.com/dashboard/project/_/storage/files/settings) section of the Dashboard and toggle the **Enable Image Transformations** option.

Note: Disabling Image Transformations prevents any image transformation requests from being processed. This can be useful to prevent unexpected usage or cost if you do not use this feature.

## Get a public URL for a transformed image

Our client libraries methods like `getPublicUrl` and `createSignedUrl` support the `transform` option. This returns the URL that serves the transformed image.

**JavaScript**

```ts
import { createClient } from '@supabase/supabase-js'

const supabase = createClient('your_project_url', 'your_supabase_api_key')

// ---cut---
supabase.storage.from('bucket').getPublicUrl('image.jpg', {
  transform: {
    width: 500,
    height: 600,
  },
})
```

**Dart**

```dart
final url = supabase.storage.from('bucket').getPublicUrl(
      'image.jpg',
      transform: const TransformOptions(
        width: 500,
        height: 600,
      ),
    );
```

**Swift**

```swift
let url = try await supabase.storage.from("bucket")
  .getPublicURL(
    path: "image.jpg"
    options: TransformOptions(with: 500, height: 600)
  )
```

**Kotlin**

```kotlin
val url = supabase.storage.from("bucket").publicRenderUrl("image.jpg") {
    size(width = 500, height = 600)
}
```

**Python**

```python
url = supabase.storage.from_('avatars').get_public_url(
  'image.jpg',
  {
    'transform': {
      'width': 500,
      'height': 500,
    },
  }
)
```

**C#**

```c#
var url = supabase.Storage.From("bucket").GetPublicUrl("image.jpg", new TransformOptions
{
    Width = 500,
    Height = 600
});
```

An example URL could look like this:

```
https://project_id.supabase.co/storage/v1/render/image/public/bucket/image.jpg?width=500&height=600`
```

## Signing URLs with transformation options

To share a transformed image in a private bucket for a fixed amount of time, provide the transform option when you create the signed URL:

**JavaScript**

```ts
import { createClient } from '@supabase/supabase-js'

const supabase = createClient('your_project_url', 'your_supabase_api_key')

// ---cut---
supabase.storage.from('bucket').createSignedUrl('image.jpg', 60000, {
  transform: {
    width: 200,
    height: 200,
  },
})
```

**Dart**

```dart
final url = await supabase.storage.from('bucket').createSignedUrl(
      'image.jpg',
      60000,
      transform: const TransformOptions(
        width: 200,
        height: 200,
      ),
    );
```

**Swift**

```swift
let url = try await supabase.storage.from("bucket")
  .createSignedURL(
    path: "image.jpg",
    expiresIn: 60,
    transform: TransformOptions(
      width: 200,
      height: 200
    )
  )
```

**Kotlin**

```kotlin
val url = supabase.storage.from("bucket").createSignedUrl("image.jpg", 60.seconds) {
	size(200, 200)
}
```

**C#**

```c#
var url = await supabase.Storage.From("bucket").CreateSignedUrl("image.jpg", 60000, new TransformOptions
{
    Width = 200,
    Height = 200
});
```

The transformation options are embedded into the token attached to the URL — they cannot be changed once signed.

## Downloading images

To download a transformed image, pass the `transform` option to the `download` function.

**JavaScript**

```ts
import { createClient } from '@supabase/supabase-js'

const supabase = createClient('your_project_url', 'your_supabase_api_key')

// ---cut---
supabase.storage.from('bucket').download('image.jpg', {
  transform: {
    width: 800,
    height: 300,
  },
})
```

**Dart**

```dart
final data = await supabase.storage.from('bucket').download(
      'image.jpg',
      transform: const TransformOptions(
        width: 800,
        height: 300,
      ),
    );
```

**Swift**

```swift
let data = try await supabase.storage.from("bucket")
  .download(
    path: "image.jpg",
    options: TransformOptions(
      width: 800,
      height: 300
    )
  )
```

**Kotlin**

```kotlin
val data = supabase.storage.from("bucket").downloadAuthenticated("image.jpg") {
    transform {
        size(800, 300)
    }
}

//Or on JVM stream directly to a file
val file = File("image.jpg")
supabase.storage.from("bucket").downloadAuthenticatedTo("image.jpg", file) {
    transform {
        size(800, 300)
    }
}
```

**Python**

```python
response = supabase.storage.from_('bucket').download(
  'image.jpg',
  {
    'width': 800,
    'height': 300,
  },
)
```

**C#**

```c#
var data = await supabase.Storage.From("bucket").Download("image.jpg", new TransformOptions
{
    Width = 800,
    Height = 300
});
```

## Automatic image optimization (WebP)

When using the image transformation API, Storage will automatically find the best format supported by the client and return that to the client, without any code change. For instance, if you use Chrome when viewing a JPEG image and using transformation options, you'll see that images are automatically optimized as `webp` images.

As a result, this will lower the egress that you send to your users and your application will load much faster.

Note: We currently only support WebP. AVIF support will come in the near future.

**Disabling automatic optimization:**

In case you'd like to return the original format of the image and **opt-out** from the automatic image optimization detection, you can pass the `format=origin` parameter when requesting a transformed image, this is also supported in the JavaScript SDK starting from v2.2.0

**JavaScript**

```ts
import { createClient } from '@supabase/supabase-js'

const supabase = createClient('your_project_url', 'your_supabase_api_key')

// ---cut---
await supabase.storage.from('bucket').download('image.jpeg', {
  transform: {
    width: 200,
    height: 200,
    format: 'origin',
  },
})
```

**Dart**

```dart
final data = await supabase.storage.from('bucket').download(
      'image.jpeg',
      transform: const TransformOptions(
        width: 200,
        height: 200,
        format: RequestImageFormat.origin,
      ),
    );
```

**Swift**

```swift
let data = try await supabase.storage.from("bucket")
  .download(
    path: "image.jpg",
    options: TransformOptions(
      width: 200,
      height: 200,
      format: "origin"
    )
  )
```

**Kotlin**

```kotlin
val data = supabase.storage.from("bucket").downloadAuthenticated("image.jpg") {
    transform {
        size(200, 200)
        format = ImageTransformation.Format.ORIGIN
    }
}

//Or on JVM stream directly to a file
val file = File("image.jpg")
supabase.storage.from("bucket").downloadAuthenticatedTo("image.jpg", file) {
    transform {
        size(200, 200)
        format = ImageTransformation.Format.ORIGIN
    }
}
```

**Python**

```python
response = supabase.storage.from_('bucket').download(
  'image.jpeg',
  {
    'transform': {
      'width': 200,
      'height': 200,
      'format': 'origin',
    },
  }
)
```

**C#**

```c#
var data = await supabase.Storage.From("bucket").Download("image.jpeg", new TransformOptions
{
    Width = 200,
    Height = 200,
    Format = "origin"
});
```

## Next.js loader

You can use Supabase Image Transformation to optimize your Next.js images using a custom [Loader](https://nextjs.org/docs/api-reference/next/image#loader-configuration).

To get started, create a `supabase-image-loader.js` file in your Next.js project which exports a default function:

```ts
const projectId = '' // your supabase project id

export default function supabaseLoader({ src, width, quality }) {
  return `https://${projectId}.supabase.co/storage/v1/render/image/public/${src}?width=${width}&quality=${quality || 75}`
}
```

In your `next.config.js` file add the following configuration to instruct Next.js to use our custom loader

```js
module.exports = {
  images: {
    loader: 'custom',
    loaderFile: './supabase-image-loader.js',
  },
}
```

At this point you are ready to use the `Image` component provided by Next.js

```tsx
import Image from 'next/image'

const MyImage = (props) => {
  return <Image src="bucket/image.png" alt="Picture of the author" width={500} height={500} />
}
```

## Transformation options

We currently support a few transformation options focusing on optimizing, resizing, and cropping images.

### Optimizing

You can set the quality of the returned image by passing a value from 20 to 100 (with 100 being the highest quality) to the `quality` parameter. This parameter defaults to 80.

Example:

**JavaScript**

```ts
import { createClient } from '@supabase/supabase-js'

const supabase = createClient('your_project_url', 'your_supabase_api_key')

// ---cut---
supabase.storage.from('bucket').download('image.jpg', {
  transform: {
    quality: 50,
  },
})
```

**Dart**

```dart
final data = await supabase.storage.from('bucket').download(
      'image.jpg',
      transform: const TransformOptions(
        quality: 50,
      ),
    );
```

**Swift**

```swift
let data = try await supabase.storage.from("bucket")
  .download(
    path: "image.jpg",
    options: TransformOptions(
      quality: 50
    )
  )
```

**Kotlin**

```kotlin
val data = supabase.storage["bucket"].downloadAuthenticated("image.jpg") {
    transform {
        quality = 50
    }
}

//Or on JVM stream directly to a file
val file = File("image.jpg")
supabase.storage["bucket"].downloadAuthenticatedTo("image.jpg", file) {
    transform {
        quality = 50
    }
}
```

**Python**

```python
response = supabase.storage.from_('bucket').download(
  'image.jpg',
  {
    'transform': {
      'quality': 50,
    },
  }
)
```

**C#**

```c#
var data = await supabase.Storage.From("bucket").Download("image.jpg", new TransformOptions
{
    Quality = 50
});
```

### Resizing

You can use `width` and `height` parameters to resize an image to a specific dimension. If only one parameter is specified, the image will be resized and cropped, maintaining the aspect ratio.

### Modes

You can use different resizing modes to fit your needs, each of them uses a different approach to resize the image:

Use the `resize` parameter with one of the following values:

- `cover` : resizes the image while keeping the aspect ratio to fill a given size and crops projecting parts. (default)

- `contain` : resizes the image while keeping the aspect ratio to fit a given size.

- `fill` : resizes the image without keeping the aspect ratio.

Example:

**JavaScript**

```ts
import { createClient } from '@supabase/supabase-js'

const supabase = createClient('your_project_url', 'your_supabase_api_key')

// ---cut---
supabase.storage.from('bucket').download('image.jpg', {
  transform: {
    width: 800,
    height: 300,
    resize: 'contain', // 'cover' | 'fill'
  },
})
```

**Dart**

```dart
final data = supabase.storage.from('bucket').download(
      'image.jpg',
      transform: const TransformOptions(
        width: 800,
        height: 300,
        resize: ResizeMode.contain, // 'cover' | 'fill'
      ),
    );
```

**Swift**

```swift
let data = try await supabase.storage.from("bucket")
  .download(
    path: "image.jpg",
    options: TransformOptions(
      width: 800,
      height: 300,
      resize: "contain" // "cover" | "fill"
    )
  )
```

**Kotlin**

```kotlin
val data = supabase.storage.from("bucket").downloadAuthenticated("image.jpg") {
    transform {
        size(800, 300)
        resize = ImageTransformation.Resize.CONTAIN
    }
}

//Or on JVM stream directly to a file
val file = File("image.jpg")
supabase.storage.from("bucket").downloadAuthenticatedTo("image.jpg", file) {
    transform {
        size(800, 300)
        resize = ImageTransformation.Resize.CONTAIN
    }
}
```

**Python**

```python
response = supabase.storage.from_('bucket').download(
  'image.jpg',
  {
    'transform': {
      'width': 800,
      'height': 300,
      'resize': 'contain', # 'cover' | 'fill'
    }
  }
)
```

**C#**

```c#
var data = await supabase.Storage.From("bucket").Download("image.jpg", new TransformOptions
{
    Width = 800,
    Height = 300,
    Resize = TransformOptions.ResizeType.Contain // Cover | Fill
});
```

### Limits

- Width and height must be an integer value between 1-2500.
- The image size cannot exceed 25MB.
- The image resolution cannot exceed 50MP.

### Supported image formats

| Format | Extension | Source | Result |
| ------ | --------- | ------ | ------ |
| PNG    | `png`     | ☑️     | ☑️     |
| JPEG   | `jpg`     | ☑️     | ☑️     |
| WebP   | `webp`    | ☑️     | ☑️     |
| AVIF   | `avif`    | ☑️     | ☑️     |
| GIF    | `gif`     | ☑️     | ☑️     |
| ICO    | `ico`     | ☑️     | ☑️     |
| SVG    | `svg`     | ☑️     | ☑️     |
| HEIC   | `heic`    | ☑️     | ❌      |
| BMP    | `bmp`     | ☑️     | ☑️     |
| TIFF   | `tiff`    | ☑️     | ☑️     |

$5 per 1,000 origin images. You are only charged for usage exceeding your
subscription plan's quota.

Note: The count resets at the start of each billing cycle.

| Plan       | Quota  | Over-Usage                 |
| ---------- | ------ | -------------------------- |
| Pro        | 100    | $5 per 1,000 origin images |
| Team       | 100    | $5 per 1,000 origin images |
| Enterprise | Custom | Custom                     |

For a detailed breakdown of how charges are calculated, refer to [Manage Storage Image Transformations usage](https://supabase.com/docs/guides/platform/manage-your-usage/storage-image-transformations).

## Self hosting

Our solution to image resizing and optimization can be self-hosted as with any other Supabase product. Under the hood we use [imgproxy](https://imgproxy.net/).

Note: If you run the official self-hosted stack from the [`supabase/supabase`](https://github.com/supabase/supabase/tree/master/docker) Docker Compose setup, an `imgproxy` service is **already included** and wired up to the `storage` service for you (the `storage` service sets `ENABLE_IMAGE_TRANSFORMATION: "true"` and `IMGPROXY_URL: http://imgproxy:5001`). You only need the steps below if you run `storage-api` outside of that Compose stack and have to provide your own imgproxy container.

### imgproxy configuration:

Deploy an imgproxy container with the following configuration:

```yaml
imgproxy:
  image: darthsim/imgproxy
  environment:
    - IMGPROXY_ENABLE_WEBP_DETECTION=true
    - IMGPROXY_JPEG_PROGRESSIVE=true
```

Note: make sure that this service can only be reachable within an internal network and not exposed to the public internet

### Storage API configuration:

Once [imgproxy](https://imgproxy.net/) is deployed we need to configure a couple of environment variables in your self-hosted [`storage-api`](https://github.com/supabase/storage-api) service as follows:

```shell
ENABLE_IMAGE_TRANSFORMATION=true
IMGPROXY_URL=yourinternalimgproxyurl.internal.com
```

